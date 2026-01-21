import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MercadoPagoConfig, Preference, Payment as MPPayment } from 'mercadopago';
import { Order } from '../orders/entities/order.entity';
import { Payment, PaymentStatus } from './entities/payment.entity';
import { OrdersService } from '../orders/orders.service';
import { CreateOrderDto } from '../orders/DTOS/orderDTO';
import { MailService } from '../common/mail/mail.service';
import { formatToBogotaISO } from '../common/utils/date.util';

@Injectable()
export class PaymentsService {
  private client: MercadoPagoConfig;
  private preference: Preference;
  private payment: MPPayment;

  private ordersService: OrdersService;

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    private readonly configService: ConfigService,
    private readonly moduleRef: ModuleRef,
    private readonly mailService: MailService,
  ) {
    try {
      const accessToken = this.configService.get<string>('MERCADO_PAGO_ACCESS_TOKEN');
      if (!accessToken) {
        console.warn('⚠️ MERCADO_PAGO_ACCESS_TOKEN is not configured. Payment features will not work.');
        // No lanzamos error aquí para que la app pueda iniciar, pero los métodos fallarán con un error claro
        return;
      }

      this.client = new MercadoPagoConfig({
        accessToken: accessToken,
        options: {
          timeout: 5000,
          idempotencyKey: 'ppp-payment',
        },
      });

      this.preference = new Preference(this.client);
      this.payment = new MPPayment(this.client);
    } catch (error) {
      console.error('Error initializing Mercado Pago client:', error);
      // Permitimos que la app inicie sin Mercado Pago si hay un error de configuración
    }
  }

  /**
   * Crea una preferencia de pago en Mercado Pago
   * La orden se creará automáticamente cuando se confirme el pago
   * @param orderData - Datos de la orden que se creará después del pago
   * @param items - Items del carrito
   * @param totalAmount - Monto total
   * @param customerInfo - Información del cliente
   * @returns URL de la preferencia y paymentId
   */
  async createPreference(
    orderData: CreateOrderDto,
    items: Array<{ title: string; quantity: number; unit_price: number }>,
    totalAmount: number,
    customerInfo: {
      name: string;
      email: string;
      phone?: string;
    },
  ) {
    if (!this.client || !this.preference) {
      throw new BadRequestException('Mercado Pago is not configured. Please set MERCADO_PAGO_ACCESS_TOKEN in environment variables.');
    }

    // URLs para Mercado Pago (webhooks y redirección)
    // Si hay URLs ngrok configuradas, usarlas para Mercado Pago (requiere HTTPS)
    // Si no, usar las URLs normales (pero puede fallar auto_return en localhost)
    let mercadopagoFrontendUrl = this.configService.get<string>('FRONTEND_URL_NGROK') || 
                                 this.configService.get<string>('FRONTEND_URL') || 
                                 'http://localhost:3000';
    let mercadopagoBackendUrl = this.configService.get<string>('BACKEND_URL_NGROK') || 
                                this.configService.get<string>('BACKEND_URL') || 
                                'http://localhost:4000';

    // URLs para autenticación normal (seguir usando ppp.local o localhost)
    const authFrontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const authBackendUrl = this.configService.get<string>('BACKEND_URL') || 'http://localhost:4000';

    // Función helper para normalizar URLs (eliminar protocolo duplicado, espacios, etc.)
    const normalizeUrl = (url: string, defaultProtocol: string = 'http'): string => {
      if (!url) return url;
      
      // Remover espacios
      url = url.trim();
      
      // Detectar y corregir protocolo duplicado (ej: http://http:domain o http://http://domain)
      // Primero, buscar patrones como "http://http:" o "https://http://"
      url = url.replace(/^https?:\/\/(https?):/i, '$1:'); // Caso: http://https:domain -> https:domain
      url = url.replace(/^https?:\/\/(https?:\/\/)/i, '$1'); // Caso: http://http://domain -> http://domain
      
      // Si ahora la URL no tiene protocolo válido al inicio, agregarlo
      if (!url.match(/^https?:\/\//i)) {
        // Si empieza con http: o https: pero sin //, corregirlo
        if (url.match(/^https?:[^/]/i)) {
          url = url.replace(/^(https?):/i, '$1://');
        } else {
          // Agregar protocolo
          url = `${defaultProtocol}://${url}`;
        }
      }
      
      // Remover múltiples // después del protocolo
      url = url.replace(/^(https?:\/\/)\/+/i, '$1');
      
      // Remover barras finales
      url = url.replace(/\/+$/, '');
      
      return url;
    };

    // Normalizar URLs para evitar duplicación de protocolo
    mercadopagoFrontendUrl = normalizeUrl(
      mercadopagoFrontendUrl || 'http://localhost:3000',
      mercadopagoFrontendUrl?.match(/^https/i) ? 'https' : 'http'
    );
    mercadopagoBackendUrl = normalizeUrl(
      mercadopagoBackendUrl || 'http://localhost:4000',
      mercadopagoBackendUrl?.match(/^https/i) ? 'https' : 'http'
    );

    // Log para debugging
    console.log('🌐 [Mercado Pago] URLs configuradas:');
    console.log(`   Frontend (Mercado Pago): ${mercadopagoFrontendUrl}`);
    console.log(`   Backend (Webhook): ${mercadopagoBackendUrl}`);
    console.log(`   Frontend (Auth): ${authFrontendUrl}`);
    console.log(`   Backend (Auth): ${authBackendUrl}`);

    // Advertencia si no usa HTTPS para Mercado Pago
    if (!mercadopagoFrontendUrl.startsWith('https://')) {
      console.warn('⚠️ [Mercado Pago] ADVERTENCIA: Usando HTTP para URLs de Mercado Pago');
      console.warn('⚠️ [Mercado Pago] El auto_return puede no funcionar correctamente con HTTP');
      console.warn('⚠️ [Mercado Pago] Para redirección automática, configura FRONTEND_URL_NGROK y BACKEND_URL_NGROK');
      console.warn(`⚠️ [Mercado Pago] Actual: ${mercadopagoFrontendUrl}`);
      console.warn('⚠️ [Mercado Pago] Recomendado: https://tu-id.ngrok-free.app (usa ngrok)');
    } else {
      console.log('✅ [Mercado Pago] Usando HTTPS para Mercado Pago (auto_return funcionará)');
    }

    // Usar las URLs de Mercado Pago para back_urls y webhook
    const baseUrl = mercadopagoFrontendUrl;
    const backendUrl = mercadopagoBackendUrl;

    // Validar que las URLs sean válidas y parseables
    if (!baseUrl || baseUrl.length === 0) {
      throw new BadRequestException('FRONTEND_URL no está configurada correctamente');
    }

    try {
      new URL(baseUrl);
    } catch {
      throw new BadRequestException(
        `FRONTEND_URL (o FRONTEND_URL_NGROK) no es una URL válida: "${baseUrl}". ` +
        'Revisa que no tengas protocolo duplicado (ej: http://http://...) y que sea una URL accesible (usa ngrok en desarrollo).',
      );
    }

    try {
      new URL(`${backendUrl}/api/payments/webhook`);
    } catch {
      throw new BadRequestException(
        `BACKEND_URL (o BACKEND_URL_NGROK) no permite una URL de webhook válida: "${backendUrl}".`,
      );
    }

    // Crear preferencia en Mercado Pago
    const payerData: any = {
      name: customerInfo.name,
      email: customerInfo.email,
    };

    if (customerInfo.phone) {
      payerData.phone = { number: customerInfo.phone };
    }

    // Construir back_urls con validación estricta
    const backUrls = {
      success: `${baseUrl}/checkout/success`,
      failure: `${baseUrl}/checkout/failure`,
      pending: `${baseUrl}/checkout/pending`,
    };

    // Validar que las URLs estén definidas y no estén vacías
    if (!backUrls.success || !backUrls.failure || !backUrls.pending) {
      throw new BadRequestException('Las URLs de retorno no están correctamente configuradas');
    }

    // Validar formato de URLs (deben ser strings válidos)
    if (typeof backUrls.success !== 'string' || backUrls.success.length === 0) {
      throw new BadRequestException(`URL de success inválida: ${backUrls.success}`);
    }
    if (typeof backUrls.failure !== 'string' || backUrls.failure.length === 0) {
      throw new BadRequestException(`URL de failure inválida: ${backUrls.failure}`);
    }
    if (typeof backUrls.pending !== 'string' || backUrls.pending.length === 0) {
      throw new BadRequestException(`URL de pending inválida: ${backUrls.pending}`);
    }

    // Construir el objeto de preferencia de forma explícita
    // IMPORTANTE: Construir back_urls primero y asegurar que todas las propiedades estén definidas
    const backUrlsObj = {
      success: String(backUrls.success || ''),
      failure: String(backUrls.failure || ''),
      pending: String(backUrls.pending || ''),
    };

    // Verificar una vez más que las URLs no estén vacías
    if (!backUrlsObj.success || !backUrlsObj.failure || !backUrlsObj.pending) {
      throw new BadRequestException(`back_urls incompleto. success: "${backUrlsObj.success}", failure: "${backUrlsObj.failure}", pending: "${backUrlsObj.pending}"`);
    }

    const preferenceData: any = {
      items: items.map(item => ({
        title: item.title,
        quantity: item.quantity,
        unit_price: item.unit_price,
      })),
      payer: payerData,
      // Construir back_urls de forma explícita asegurando que sea un objeto plano válido
      back_urls: backUrlsObj,
      auto_return: 'all', // 'all' = redirige en approved, pending y failure (máxima compatibilidad)
      external_reference: `payment_${Date.now()}`, // Usamos timestamp único ya que no hay orderId aún
      notification_url: `${backendUrl}/api/payments/webhook`,
      metadata: {
        // Guardamos los datos de la orden para crearla después del pago
        order_data: orderData,
      },
    };

    // Verificar que back_urls está presente y tiene success ANTES de enviar
    if (!preferenceData.back_urls || typeof preferenceData.back_urls !== 'object') {
      throw new BadRequestException('back_urls debe ser un objeto válido');
    }
    if (!preferenceData.back_urls.success || typeof preferenceData.back_urls.success !== 'string') {
      throw new BadRequestException(`back_urls.success debe ser un string válido. Valor recibido: ${JSON.stringify(preferenceData.back_urls.success)}`);
    }

    // Log para debugging - SIEMPRE mostrar para debugging
    console.log('🔧 [Mercado Pago] Creating preference with:', JSON.stringify({
      back_urls: preferenceData.back_urls,
      auto_return: preferenceData.auto_return,
      baseUrl,
      backendUrl,
      hasBackUrls: !!preferenceData.back_urls,
      successUrl: preferenceData.back_urls?.success,
      failureUrl: preferenceData.back_urls?.failure,
      pendingUrl: preferenceData.back_urls?.pending,
    }, null, 2));

    try {
      // Validar que back_urls esté correctamente formateado antes de enviar
      if (!preferenceData.back_urls || 
          !preferenceData.back_urls.success || 
          !preferenceData.back_urls.failure || 
          !preferenceData.back_urls.pending) {
        console.error('❌ [Mercado Pago] back_urls inválido:', JSON.stringify(preferenceData.back_urls, null, 2));
        throw new BadRequestException('back_urls no está correctamente configurado. Todas las URLs (success, failure, pending) deben estar definidas.');
      }

      console.log('📤 [Mercado Pago] Sending preference data to API:', JSON.stringify({
        items: preferenceData.items.length,
        has_back_urls: !!preferenceData.back_urls,
        back_urls: preferenceData.back_urls,
        back_urls_type: typeof preferenceData.back_urls,
        back_urls_keys: preferenceData.back_urls ? Object.keys(preferenceData.back_urls) : [],
        success_exists: !!preferenceData.back_urls?.success,
        success_value: preferenceData.back_urls?.success,
        auto_return: preferenceData.auto_return,
      }, null, 2));

      // Construir el body de forma completamente explícita para evitar problemas de serialización
      // El SDK de Mercado Pago v2 puede tener problemas con objetos que tienen prototipos
      // IMPORTANTE: Construir cada campo explícitamente como primitivo
      const bodyToSend: any = {
        items: preferenceData.items.map((item: any) => ({
          title: String(item.title),
          quantity: Number(item.quantity),
          unit_price: Number(item.unit_price),
        })),
        payer: {
          name: String(preferenceData.payer.name),
          email: String(preferenceData.payer.email),
          ...(preferenceData.payer.phone && { 
            phone: typeof preferenceData.payer.phone === 'string' 
              ? { number: String(preferenceData.payer.phone) }
              : preferenceData.payer.phone
          }),
        },
        back_urls: {
          success: String(preferenceData.back_urls.success),
          failure: String(preferenceData.back_urls.failure),
          pending: String(preferenceData.back_urls.pending),
        },
        auto_return: 'approved',
        external_reference: String(preferenceData.external_reference),
        notification_url: String(preferenceData.notification_url),
      };
      
      // Agregar metadata solo si existe y no está vacío
      if (preferenceData.metadata && Object.keys(preferenceData.metadata).length > 0) {
        bodyToSend.metadata = preferenceData.metadata;
      }

      // Verificación final explícita
      if (!bodyToSend.back_urls || !bodyToSend.back_urls.success) {
        console.error('❌ [Mercado Pago] CRITICAL: back_urls.success is missing after JSON serialization!');
        console.error('❌ [Mercado Pago] bodyToSend:', JSON.stringify(bodyToSend, null, 2));
        throw new BadRequestException('back_urls.success se perdió durante la serialización del objeto');
      }

      console.log('📤 [Mercado Pago] Final body structure:', JSON.stringify({
        back_urls: bodyToSend.back_urls,
        back_urls_success_type: typeof bodyToSend.back_urls.success,
        back_urls_success_value: bodyToSend.back_urls.success,
        back_urls_keys: Object.keys(bodyToSend.back_urls || {}),
        auto_return: bodyToSend.auto_return,
        has_auto_return: !!bodyToSend.auto_return,
      }, null, 2));

      // IMPORTANTE: Intentar SIEMPRE con auto_return para redirección automática
      // Esto es lo normal y esperado. Si falla, solo entonces usar fallback sin auto_return
      try {
        console.log('🚀 [Mercado Pago] Creando preferencia CON auto_return para redirección automática...');
        console.log('🔗 [Mercado Pago] URLs de redirección:');
        console.log(`   Success: ${bodyToSend.back_urls.success}`);
        console.log(`   Failure: ${bodyToSend.back_urls.failure}`);
        console.log(`   Pending: ${bodyToSend.back_urls.pending}`);
        
        const response = await this.preference.create({ body: bodyToSend });
        
        console.log('✅ [Mercado Pago] Preferencia creada exitosamente CON auto_return');
        console.log(`   Preference ID: ${response.id}`);
        console.log(`   Init Point: ${response.init_point || response.sandbox_init_point || 'N/A'}`);
        if (!mercadopagoFrontendUrl.startsWith('https://')) {
          console.warn('⚠️ [Mercado Pago] La redirección automática suele FALLAR con HTTP. Configura FRONTEND_URL_NGROK con HTTPS (ngrok).');
        } else {
          console.log('   ℹ️ Redirección: Mercado Pago redirigirá a', bodyToSend.back_urls.success);
        }
        
        // Verificar que response.id existe
        if (!response.id) {
          throw new BadRequestException('No se recibió un ID de preferencia válido de Mercado Pago');
        }

        const preferenceId = response.id as string;
        const initPoint = response.init_point || response.sandbox_init_point || '';

        // Guardar el pago en la base de datos (sin orderId aún)
        const payment = this.paymentRepo.create({
          orderId: null, // Se asignará cuando se cree la orden
          preferenceId: preferenceId,
          amount: totalAmount,
          status: 'pending' as PaymentStatus,
          metadata: JSON.stringify({
            preference_id: preferenceId,
            init_point: initPoint,
            order_data: orderData, // Guardamos los datos de la orden para crearla después
            external_reference: preferenceData.external_reference,
            customer_email: customerInfo.email, // Email del usuario logueado (MP en sandbox devuelve test_user@testuser.com)
          }),
        });

        await this.paymentRepo.save(payment);

        return {
          preferenceId: preferenceId,
          initPoint: initPoint,
          paymentId: payment.id,
        };
      } catch (createError: any) {
        // Log completo del error para diagnosticar
        console.error('📛 [Mercado Pago] Error al crear preferencia:', createError?.message);
        if (createError?.cause) console.error('   cause:', createError.cause);
        if (createError?.error) console.error('   error:', createError.error);
        if (createError?.response?.data) console.error('   response.data:', JSON.stringify(createError.response.data));

        // Si falla con auto_return, intentar sin auto_return (FALLBACK - no es lo ideal)
        // Normalmente auto_return debería funcionar. Si falla, puede ser por:
        // 1. URLs HTTP en localhost (Mercado Pago exige HTTPS para auto_return)
        // 2. URLs no accesibles desde internet (necesita ngrok)
        // 3. Error en la configuración de back_urls
        if (createError?.error === 'invalid_auto_return' || createError?.message?.includes('auto_return')) {
          console.warn('⚠️ [Mercado Pago] ADVERTENCIA: Error al crear preferencia con auto_return ("approved")');
          console.warn('⚠️ [Mercado Pago] Razón posible: URLs HTTP (Mercado Pago exige HTTPS para auto_return) o URLs no accesibles desde internet');
          console.warn('⚠️ [Mercado Pago] Solución: Configura FRONTEND_URL_NGROK con tu URL HTTPS de ngrok (ej: https://xxx.ngrok-free.app)');
          console.warn('⚠️ [Mercado Pago] Continuando sin auto_return - El usuario deberá hacer clic en "Volver al sitio"');
          
          // IMPORTANTE: Aunque no hay auto_return, SÍ incluimos back_urls
          // Esto es necesario para que Mercado Pago muestre el botón "Volver al sitio"
          const bodyWithoutAutoReturn = JSON.parse(JSON.stringify({
            items: bodyToSend.items,
            payer: bodyToSend.payer,
            // ⚠️ IMPORTANTE: Incluir back_urls para que aparezca el botón de volver
            back_urls: bodyToSend.back_urls,
            external_reference: bodyToSend.external_reference,
            notification_url: bodyToSend.notification_url,
            metadata: bodyToSend.metadata,
            // NOTA: Sin auto_return, el usuario debe hacer clic en "Volver al sitio"
            // PERO back_urls sigue siendo necesario para que el botón aparezca
          }));
          
          console.log('📤 [Mercado Pago] Creando preferencia sin auto_return (fallback):', JSON.stringify({
            back_urls: bodyWithoutAutoReturn.back_urls,
            has_auto_return: false,
          }, null, 2));
          
          const response = await this.preference.create({ body: bodyWithoutAutoReturn });
          
          console.warn('⚠️ [Mercado Pago] Preferencia creada SIN auto_return - Redirección manual requerida');
          
          if (!response.id) {
            throw new BadRequestException('No se recibió un ID de preferencia válido de Mercado Pago');
          }

          const preferenceId = response.id as string;
          const initPoint = response.init_point || response.sandbox_init_point || '';

          const payment = this.paymentRepo.create({
            orderId: null,
            preferenceId: preferenceId,
            amount: totalAmount,
            status: 'pending' as PaymentStatus,
            metadata: JSON.stringify({
              preference_id: preferenceId,
              init_point: initPoint,
              order_data: orderData,
              external_reference: preferenceData.external_reference,
              customer_email: customerInfo.email,
            }),
          });

          await this.paymentRepo.save(payment);

          return {
            preferenceId: preferenceId,
            initPoint: initPoint,
            paymentId: payment.id,
          };
        }
        // Si no es error de auto_return, relanzar el error original
        console.error('📛 [Mercado Pago] No se usó fallback. Revisa FRONTEND_URL_NGROK (HTTPS) y que back_urls.success sea una URL pública válida.');
        throw createError;
      }
    } catch (error: any) {
      console.error('❌ Error creating Mercado Pago preference:', error);
      
      // Log detallado del error para debugging
      if (error.response?.data) {
        console.error('📋 Mercado Pago API Error Details:', JSON.stringify(error.response.data, null, 2));
      }
      if (error.cause) {
        console.error('🔍 Error cause:', error.cause);
      }
      
      // Proporcionar un mensaje más descriptivo
      const errorMessage = error.response?.data?.message 
        || error.message 
        || 'Failed to create payment preference';
      
      throw new BadRequestException(
        `Error al crear la preferencia de pago: ${errorMessage}`
      );
    }
  }

  /**
   * Maneja el webhook de Mercado Pago
   * @param data - Datos del webhook
   */
  async handleWebhook(data: any) {
    console.log('🔔 [Webhook] Received webhook data:', JSON.stringify(data, null, 2));
    
    try {
      if (!this.client || !this.payment) {
        console.error('❌ [Webhook] Mercado Pago client not initialized. Cannot process webhook.');
        return { success: false, message: 'Mercado Pago is not configured' };
      }

      const { type, data: webhookData } = data || {};

      if (type === 'payment') {
        const paymentId = webhookData?.id;
        if (!paymentId) {
          console.warn('⚠️ [Webhook] Received without payment ID:', JSON.stringify(data, null, 2));
          return { success: false, message: 'Payment ID not found' };
        }

        console.log(`📥 [Webhook] Processing payment ID: ${paymentId}`);

        // Obtener información del pago desde Mercado Pago
        const mpPayment: any = await this.payment.get({ id: paymentId.toString() });
        
        console.log('📋 [Webhook] Mercado Pago payment data:', JSON.stringify({
          id: mpPayment.id,
          status: mpPayment.status,
          external_reference: mpPayment.external_reference,
          preference_id: mpPayment.preference_id,
          status_detail: mpPayment.status_detail,
          transaction_amount: mpPayment.transaction_amount,
        }, null, 2));

        if (!mpPayment) {
          return { success: false, message: 'Payment not found in Mercado Pago' };
        }

        // Buscar el pago por external_reference (mejor método) o paymentId
        let payment: Payment | null = null;
        
        // Primero intentar buscar por external_reference en metadata
        if (mpPayment.external_reference) {
          const allPayments = await this.paymentRepo.find({
            where: {},
            relations: ['order'],
          });
          
          for (const p of allPayments) {
            try {
              const meta = JSON.parse(p.metadata || '{}');
              if (meta.external_reference === mpPayment.external_reference) {
                payment = p;
                break;
              }
            } catch (e) {
              // Ignorar errores de parse
            }
          }
        }
        
        // Si no se encuentra, buscar por paymentId
        if (!payment) {
          payment = await this.paymentRepo.findOne({
            where: { paymentId: paymentId.toString() },
            relations: ['order'],
          });
        }

        if (!payment) {
          console.error('Payment record not found for payment_id:', paymentId);
          return { success: false, message: 'Payment record not found' };
        }

        // En este punto TypeScript sabe que payment no es null
        const foundPayment = payment;

        // Actualizar estado del pago
        let status: PaymentStatus = 'pending';
        if (mpPayment.status === 'approved') {
          status = 'approved';
        } else if (mpPayment.status === 'rejected' || mpPayment.status === 'cancelled') {
          status = mpPayment.status as PaymentStatus;
        } else if (mpPayment.status === 'refunded') {
          status = 'refunded';
        }

        foundPayment.status = status;
        foundPayment.paymentId = paymentId.toString();
        
        // Parse metadata de forma segura
        let metadataObj: any = {};
        try {
          if (foundPayment.metadata) {
            metadataObj = JSON.parse(foundPayment.metadata);
          }
        } catch (e) {
          console.warn('Error parsing payment metadata, using empty object:', e);
        }
        
        // Si el pago fue aprobado y aún no existe la orden, crearla
        if (status === 'approved' && !foundPayment.orderId && metadataObj.order_data) {
          try {
            console.log('💰 [Webhook] Payment approved! Creating order from payment metadata...');
            console.log('📦 [Webhook] Order data from metadata:', JSON.stringify(metadataObj.order_data, null, 2));
            
            // Obtener OrdersService de forma lazy para evitar problemas de inicialización
            if (!this.ordersService) {
              this.ordersService = this.moduleRef.get(OrdersService, { strict: false });
            }
            
            // Crear la orden (orderSource: 'online' = cliente/ppp-front vía pago)
            const orderDataWithEmail = {
              ...metadataObj.order_data,
              customerEmail: metadataObj.customer_email || null,
              orderSource: 'online' as const,
            };
            const orderResponse = await this.ordersService.create(orderDataWithEmail);
            
            // Asignar el orderId al pago
            foundPayment.orderId = orderResponse.orderId;
            
            console.log(`✅ [Webhook] Order created successfully!`);
            console.log(`   Order ID: ${orderResponse.orderId}`);
            console.log(`   Daily Order Number: ${orderResponse.dailyOrderNumber}`);
            console.log(`   Payment ID: ${paymentId}`);
            
            // Aplicar premio de redención si existe
            if (orderDataWithEmail.redemptionCode) {
              try {
                console.log(`🎁 [Webhook] Applying redemption prize: ${orderDataWithEmail.redemptionCode}`);
                await this.ordersService.applyRedemptionVoucher(
                  orderResponse.orderId,
                  orderDataWithEmail.redemptionCode
                );
                console.log(`✅ [Webhook] Redemption prize applied successfully!`);
              } catch (prizeError: any) {
                // No fallar la creación de la orden si el premio falla
                console.error(`❌ [Webhook] Failed to apply redemption prize:`, prizeError?.message || prizeError);
                // La orden se crea igual, pero sin el premio aplicado
              }
            }
            
            // Enviar correo de confirmación de orden
            try {
              // Obtener la orden completa para el correo
              const fullOrder = await this.orderRepo.findOne({
                where: { id: orderResponse.orderId },
                relations: ['items', 'items.product'],
              });

              // Usar email del usuario logueado (customer_email en metadata); en sandbox MP devuelve test_user@testuser.com
              const emailTo = metadataObj.customer_email || mpPayment?.payer?.email;
              
              if (fullOrder && emailTo) {
                // Agrupar items por producto (cada OrderItem es 1 unidad, pero se agrupan)
                const groupedItems: Record<number, { productName: string; quantity: number; price: number }> = {};
                
                for (const item of fullOrder.items) {
                  const productId = item.product?.id || 0;
                  const productName = item.product?.name || 'Producto';
                  const price = item.product?.price || 0;
                  
                  if (!groupedItems[productId]) {
                    groupedItems[productId] = {
                      productName,
                      quantity: 0,
                      price,
                    };
                  }
                  
                  // Cada OrderItem representa 1 unidad
                  groupedItems[productId].quantity += 1;
                }
                
                // Preparar items para el correo
                const emailItems = Object.values(groupedItems);
                
                // Total: usar transaction_amount de MP (monto realmente cobrado). Si no hay, subtotal + envío
                const subtotal = emailItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
                const deliveryNum = Number(fullOrder.deliveryFee) || 0;
                const totalForEmail =
                  (mpPayment.transaction_amount != null && mpPayment.transaction_amount !== '')
                    ? Number(mpPayment.transaction_amount)
                    : subtotal + deliveryNum;
                
                // Enviar correo de confirmación al email del usuario que hizo el pedido
                const orderNum = fullOrder.dailyOrderNumber ?? fullOrder.id;
                const sent = await this.mailService.sendOrderConfirmation(
                  emailTo,
                  orderNum,
                  fullOrder.customerName || mpPayment.payer?.name || 'Cliente',
                  emailItems,
                  totalForEmail,
                  String(fullOrder.orderType || 'delivery'),
                  fullOrder.address,
                  fullOrder.phone,
                  deliveryNum > 0 ? deliveryNum : undefined,
                );

                if (sent) {
                  console.log(`✅ [Webhook] Correo de confirmación enviado a ${emailTo} (orden #${orderNum})`);
                } else {
                  console.warn('⚠️ [Webhook] Correo no enviado (revisa MAIL_* en .env)');
                }
              } else {
                console.warn('⚠️ [Webhook] No se envía correo: falta orden, items o email (customer_email en metadata o payer.email)');
              }
            } catch (emailError: any) {
              // No fallar el webhook si el correo falla, solo loguear
              console.error('❌ [Webhook] Error al enviar correo de confirmación:', emailError?.message);
              console.error('   Detalle:', emailError?.stack || emailError);
            }
          } catch (error: any) {
            console.error('❌ [Webhook] Error creating order from payment:', error);
            console.error('❌ [Webhook] Error details:', JSON.stringify({
              message: error.message,
              stack: error.stack,
              order_data: metadataObj.order_data,
            }, null, 2));
            // Continuamos para actualizar el pago aunque falle la creación de la orden
          }
        } else if (status === 'approved' && foundPayment.orderId) {
          console.log(`✅ [Webhook] Payment already has order associated: Order ID ${foundPayment.orderId}`);
        } else if (status === 'approved' && !metadataObj.order_data) {
          console.warn('⚠️ [Webhook] Payment approved but no order_data in metadata to create order');
        }
        
        foundPayment.metadata = JSON.stringify({
          ...metadataObj,
          mp_payment: mpPayment,
        });

        await this.paymentRepo.save(foundPayment);

        console.log('✅ [Webhook] Payment saved successfully');
        console.log(`   Payment ID (internal): ${foundPayment.id}`);
        console.log(`   Payment ID (Mercado Pago): ${foundPayment.paymentId}`);
        console.log(`   Order ID: ${foundPayment.orderId || 'NOT CREATED YET'}`);
        console.log(`   Status: ${foundPayment.status}`);

        return {
          success: true,
          paymentId: foundPayment.id,
          status: foundPayment.status,
          orderId: foundPayment.orderId,
          message: foundPayment.orderId 
            ? `Order #${foundPayment.orderId} created successfully` 
            : 'Payment processed but order not created yet',
        };
      }

      return { success: true, message: 'Webhook processed (not a payment event)' };
    } catch (error: any) {
      console.error('❌ [Webhook] Error processing webhook:', error);
      console.error('❌ [Webhook] Error stack:', error.stack);
      return { success: false, message: error.message };
    }
  }

  /**
   * Obtiene el estado de un pago
   * @param orderId - ID de la orden
   */
  async getPaymentStatus(orderId: number) {
    const payment = await this.paymentRepo.findOne({
      where: { orderId },
      order: { createdAt: 'DESC' },
    });

    if (!payment) {
      return null;
    }

    return {
      id: payment.id,
      orderId: payment.orderId,
      status: payment.status,
      amount: payment.amount,
      preferenceId: payment.preferenceId,
      paymentId: payment.paymentId,
      createdAt: formatToBogotaISO(payment.createdAt),
      updatedAt: formatToBogotaISO(payment.updatedAt),
    };
  }

  /**
   * Obtiene un pago por su preference ID
   * @param preferenceId - Preference ID de Mercado Pago
   */
  async getPaymentByPreference(preferenceId: string) {
    const payment = await this.paymentRepo.findOne({
      where: { preferenceId },
      relations: ['order'],
    });

    if (!payment) {
      return null;
    }

    let metadataObj: any = {};
    try {
      if (payment.metadata) {
        metadataObj = JSON.parse(payment.metadata);
      }
    } catch (e) {
      console.warn('Error parsing payment metadata:', e);
    }

    return {
      id: payment.id,
      orderId: payment.orderId,
      status: payment.status,
      amount: payment.amount,
      preferenceId: payment.preferenceId,
      paymentId: payment.paymentId,
      hasOrder: !!payment.orderId,
      orderData: metadataObj.order_data || null,
      createdAt: formatToBogotaISO(payment.createdAt),
      updatedAt: formatToBogotaISO(payment.updatedAt),
      order: payment.orderId ? {
        id: payment.order?.id,
        dailyOrderNumber: payment.order?.dailyOrderNumber,
        orderStatus: payment.order?.orderStatus,
      } : null,
    };
  }

  /**
   * Obtiene un pago por su ID interno
   * @param paymentId - ID interno del pago
   */
  async getPaymentById(paymentId: number) {
    const payment = await this.paymentRepo.findOne({
      where: { id: paymentId },
      relations: ['order'],
    });

    if (!payment) {
      return null;
    }

    let metadataObj: any = {};
    try {
      if (payment.metadata) {
        metadataObj = JSON.parse(payment.metadata);
      }
    } catch (e) {
      console.warn('Error parsing payment metadata:', e);
    }

    return {
      id: payment.id,
      orderId: payment.orderId,
      status: payment.status,
      amount: payment.amount,
      preferenceId: payment.preferenceId,
      paymentId: payment.paymentId,
      hasOrder: !!payment.orderId,
      orderData: metadataObj.order_data || null,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
      order: payment.orderId ? {
        id: payment.order?.id,
        dailyOrderNumber: payment.order?.dailyOrderNumber,
        orderStatus: payment.order?.orderStatus,
      } : null,
    };
  }
}
