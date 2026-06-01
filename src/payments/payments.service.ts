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
    } catch {
      // Permitir que la app inicie sin Mercado Pago si hay un error de configuración
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
      throw new BadRequestException('Mercado Pago no está configurado. Configura MERCADO_PAGO_ACCESS_TOKEN en las variables de entorno.');
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

    try {
      if (!preferenceData.back_urls ||
          !preferenceData.back_urls.success ||
          !preferenceData.back_urls.failure ||
          !preferenceData.back_urls.pending) {
        throw new BadRequestException('back_urls no está correctamente configurado. Todas las URLs (success, failure, pending) deben estar definidas.');
      }

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

      if (!bodyToSend.back_urls || !bodyToSend.back_urls.success) {
        throw new BadRequestException('back_urls.success se perdió durante la serialización del objeto');
      }

      try {
        const response = await this.preference.create({ body: bodyToSend });
        if (!response.id) {
          throw new BadRequestException('No se recibió un ID de preferencia válido de Mercado Pago');
        }
        const preferenceId = response.id as string;
        const accessToken =
          this.configService.get<string>('MERCADO_PAGO_ACCESS_TOKEN') || '';
        const useSandboxCheckout = accessToken.trim().startsWith('TEST-');
        const initPoint = useSandboxCheckout
          ? (response.sandbox_init_point || response.init_point || '')
          : (response.init_point || response.sandbox_init_point || '');

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
        if (createError?.error === 'invalid_auto_return' || createError?.message?.includes('auto_return')) {
          const bodyWithoutAutoReturn = JSON.parse(JSON.stringify({
            items: bodyToSend.items,
            payer: bodyToSend.payer,
            back_urls: bodyToSend.back_urls,
            external_reference: bodyToSend.external_reference,
            notification_url: bodyToSend.notification_url,
            metadata: bodyToSend.metadata,
          }));
          const response = await this.preference.create({ body: bodyWithoutAutoReturn });
          if (!response.id) {
            throw new BadRequestException('No se recibió un ID de preferencia válido de Mercado Pago');
          }

          const preferenceId = response.id as string;
          const accessTokenRetry =
            this.configService.get<string>('MERCADO_PAGO_ACCESS_TOKEN') || '';
          const useSandboxRetry = accessTokenRetry.trim().startsWith('TEST-');
          const initPoint = useSandboxRetry
            ? (response.sandbox_init_point || response.init_point || '')
            : (response.init_point || response.sandbox_init_point || '');

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
        throw createError;
      }
    } catch (error: any) {
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
    try {
      if (!this.client || !this.payment) {
        return { success: false, message: 'Mercado Pago is not configured' };
      }

      const { type, data: webhookData } = data || {};

      if (type === 'payment') {
        const paymentId = webhookData?.id;
        if (!paymentId) {
          return { success: false, message: 'ID de pago no encontrado' };
        }

        const mpPayment: any = await this.payment.get({ id: paymentId.toString() });

        if (!mpPayment) {
          return { success: false, message: 'Pago no encontrado en Mercado Pago' };
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
          return { success: false, message: 'Registro de pago no encontrado' };
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
        } catch {
          // use empty metadata
        }

        if (status === 'approved' && !foundPayment.orderId && metadataObj.order_data) {
          try {
            if (!this.ordersService) {
              this.ordersService = this.moduleRef.get(OrdersService, { strict: false });
            }
            const orderDataWithEmail = {
              ...metadataObj.order_data,
              customerEmail: metadataObj.customer_email || null,
              orderSource: 'online' as const,
            };
            const orderResponse = await this.ordersService.create(orderDataWithEmail);
            foundPayment.orderId = orderResponse.orderId;

            if (orderDataWithEmail.redemptionCode) {
              try {
                await this.ordersService.applyRedemptionVoucher(
                  orderResponse.orderId,
                  orderDataWithEmail.redemptionCode
                );
              } catch {
                // Orden se crea igual, sin premio aplicado
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

              }
            } catch {
              // No fallar el webhook si el correo falla
            }
          } catch {
            // Continuar para actualizar el pago aunque falle la creación de la orden
          }
        }

        foundPayment.metadata = JSON.stringify({
          ...metadataObj,
          mp_payment: mpPayment,
        });

        await this.paymentRepo.save(foundPayment);

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

      return { success: true, message: 'Webhook procesado (no es un evento de pago)' };
    } catch (error: any) {
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
    } catch {
      // use empty metadata
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
    } catch {
      // use empty metadata
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
