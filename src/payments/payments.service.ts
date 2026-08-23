import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { MercadoPagoConfig, Preference, Payment as MPPayment } from 'mercadopago';
import { Order } from '../orders/entities/order.entity';
import { Payment, PaymentStatus } from './entities/payment.entity';
import { OrdersService } from '../orders/orders.service';
import { CreateOrderDto } from '../orders/DTOS/orderDTO';
import { MailService } from '../common/mail/mail.service';
import { formatToBogotaISO } from '../common/utils/date.util';
import { BusinessService } from '../business/business.service';
import { ProductsService } from '../products/products.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private client: MercadoPagoConfig;
  private preference: Preference;
  private payment: MPPayment;

  private ordersService: OrdersService;

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly moduleRef: ModuleRef,
    private readonly mailService: MailService,
    private readonly businessService: BusinessService,
    private readonly productsService: ProductsService,
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
    options?: {
      channel?: 'online' | 'whatsapp';
      conversationId?: number;
      waId?: string;
      bypassOnlineHours?: boolean;
    },
  ) {
    if (!this.client || !this.preference) {
      throw new BadRequestException('Mercado Pago no está configurado. Configura MERCADO_PAGO_ACCESS_TOKEN en las variables de entorno.');
    }

    if (!options?.bypassOnlineHours) {
      await this.businessService.assertAcceptingOnlineOrders();
    }
    const productIds = (orderData.items ?? []).map((i) => i.productId);
    await this.productsService.assertOnlineProductsAvailable(productIds);

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
        ...(options?.channel && { channel: options.channel }),
        ...(options?.conversationId != null && { conversation_id: options.conversationId }),
        ...(options?.waId && { wa_id: options.waId }),
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
        const response = await this.preference.create({
          body: bodyToSend,
          requestOptions: {
            idempotencyKey: `pref-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
          },
        });
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
            ...(options?.channel && { channel: options.channel }),
            ...(options?.conversationId != null && { conversation_id: options.conversationId }),
            ...(options?.waId && { wa_id: options.waId }),
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
          const response = await this.preference.create({
            body: bodyWithoutAutoReturn,
            requestOptions: {
              idempotencyKey: `pref-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
            },
          });
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
              ...(options?.channel && { channel: options.channel }),
              ...(options?.conversationId != null && { conversation_id: options.conversationId }),
              ...(options?.waId && { wa_id: options.waId }),
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
   * Maneja el webhook de Mercado Pago.
   * Idempotente: un payment_id / fila de pago solo puede crear UNA orden
   * (lock FOR UPDATE + persistir orderId ANTES del correo).
   */
  async handleWebhook(data: any) {
    try {
      if (!this.client || !this.payment) {
        return { success: false, message: 'Mercado Pago is not configured' };
      }

      const { type, data: webhookData } = data || {};

      if (type !== 'payment') {
        return { success: true, message: 'Webhook procesado (no es un evento de pago)' };
      }

      const paymentId = webhookData?.id;
      if (!paymentId) {
        return { success: false, message: 'ID de pago no encontrado' };
      }

      const mpPaymentId = paymentId.toString();
      const mpPayment: any = await this.payment.get({ id: mpPaymentId });

      if (!mpPayment) {
        return { success: false, message: 'Pago no encontrado en Mercado Pago' };
      }

      // 1) Idempotencia por payment_id de MP (si ya hay orden ligada, no crear otra)
      const alreadyByMpId = await this.paymentRepo.findOne({
        where: { paymentId: mpPaymentId },
      });
      if (alreadyByMpId?.orderId) {
        this.logger.log(
          `[webhook] Pago MP ${mpPaymentId} ya tiene orderId=${alreadyByMpId.orderId}; skip`,
        );
        return {
          success: true,
          paymentId: alreadyByMpId.id,
          status: alreadyByMpId.status,
          orderId: alreadyByMpId.orderId,
          message: `Order #${alreadyByMpId.orderId} already linked (idempotent)`,
        };
      }

      // 2) Localizar fila de preferencia
      let paymentRow: Payment | null = alreadyByMpId;

      if (!paymentRow && mpPayment.external_reference) {
        const allPayments = await this.paymentRepo.find({ where: {} });
        for (const p of allPayments) {
          try {
            const meta = JSON.parse(p.metadata || '{}');
            if (meta.external_reference === mpPayment.external_reference) {
              paymentRow = p;
              break;
            }
          } catch {
            // ignore
          }
        }
      }

      if (!paymentRow) {
        return { success: false, message: 'Registro de pago no encontrado' };
      }

      let status: PaymentStatus = 'pending';
      if (mpPayment.status === 'approved') {
        status = 'approved';
      } else if (mpPayment.status === 'rejected' || mpPayment.status === 'cancelled') {
        status = mpPayment.status as PaymentStatus;
      } else if (mpPayment.status === 'refunded') {
        status = 'refunded';
      }

      let metadataObj: any = {};
      try {
        if (paymentRow.metadata) metadataObj = JSON.parse(paymentRow.metadata);
      } catch {
        metadataObj = {};
      }

      // 3) Transacción con lock: solo un webhook concurrente crea la orden
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      let createdOrderId: number | null = null;
      let shouldSendEmail = false;
      let emailContext: {
        orderId: number;
        emailTo: string;
        customerName: string;
      } | null = null;

      try {
        const locked = await queryRunner.manager
          .getRepository(Payment)
          .createQueryBuilder('p')
          .setLock('pessimistic_write')
          .where('p.id = :id', { id: paymentRow.id })
          .getOne();

        if (!locked) {
          await queryRunner.rollbackTransaction();
          return { success: false, message: 'Registro de pago no encontrado' };
        }

        locked.status = status;
        locked.paymentId = mpPaymentId;
        locked.metadata = JSON.stringify({
          ...metadataObj,
          mp_payment: mpPayment,
        });

        // Ya tiene orden → solo actualizar estado/metadata
        if (locked.orderId) {
          await queryRunner.manager.save(locked);
          await queryRunner.commitTransaction();
          this.logger.log(
            `[webhook] Pago #${locked.id} ya vinculado a orderId=${locked.orderId}; skip create`,
          );
          return {
            success: true,
            paymentId: locked.id,
            status: locked.status,
            orderId: locked.orderId,
            message: `Order #${locked.orderId} already linked (idempotent)`,
          };
        }

        if (status === 'approved' && metadataObj.order_data) {
          if (!this.ordersService) {
            this.ordersService = this.moduleRef.get(OrdersService, { strict: false });
          }

          const isWhatsapp =
            metadataObj.channel === 'whatsapp' ||
            metadataObj.order_data?.orderSource === 'whatsapp';

          const orderDataWithEmail = {
            ...metadataObj.order_data,
            customerEmail: isWhatsapp
              ? metadataObj.customer_email || metadataObj.order_data?.customerEmail || null
              : metadataObj.customer_email || null,
            orderSource: isWhatsapp ? ('whatsapp' as const) : ('online' as const),
            // Misma clave si MP reenvía el webhook del mismo pago
            clientRequestId: `mp-pay-${locked.paymentId || locked.id}`.slice(0, 64),
          };

          const orderResponse = await this.ordersService.create(orderDataWithEmail);
          locked.orderId = orderResponse.orderId;
          createdOrderId = orderResponse.orderId;

          // Persistir orderId DENTRO de la TX, ANTES del correo (cierra la race)
          await queryRunner.manager.save(locked);
          await queryRunner.commitTransaction();

          if (orderDataWithEmail.redemptionCode) {
            try {
              await this.ordersService.applyRedemptionVoucher(
                orderResponse.orderId,
                orderDataWithEmail.redemptionCode,
              );
            } catch {
              // Orden se crea igual
            }
          }

          if (isWhatsapp) {
            const conversationId = Number(metadataObj.conversation_id);
            const waId = String(metadataObj.wa_id || '');
            if (conversationId && waId) {
              void this.notifyWhatsappPaymentSuccess({
                conversationId,
                waId,
                orderId: orderResponse.orderId,
              });
            } else {
              this.logger.warn(
                `[webhook] Pago WhatsApp sin conversation_id/wa_id (order #${orderResponse.orderId})`,
              );
            }
          }

          const emailTo = metadataObj.customer_email || mpPayment?.payer?.email;
          if (emailTo && !String(emailTo).endsWith('@whatsapp.ppp.local')) {
            shouldSendEmail = true;
            emailContext = {
              orderId: orderResponse.orderId,
              emailTo,
              customerName:
                metadataObj.order_data?.customerName ||
                mpPayment.payer?.name ||
                'Cliente',
            };
          }
        } else {
          await queryRunner.manager.save(locked);
          await queryRunner.commitTransaction();
        }

        // Correo FUERA de la TX y sin bloquear el claim de orderId
        if (shouldSendEmail && emailContext) {
          void this.sendOrderConfirmationEmail(
            emailContext.orderId,
            emailContext.emailTo,
            emailContext.customerName,
            mpPayment,
          );
        }

        return {
          success: true,
          paymentId: paymentRow.id,
          status,
          orderId: createdOrderId ?? paymentRow.orderId,
          message: createdOrderId
            ? `Order #${createdOrderId} created successfully`
            : 'Payment processed but order not created yet',
        };
      } catch (err) {
        if (queryRunner.isTransactionActive) {
          await queryRunner.rollbackTransaction();
        }
        this.logger.error(`[webhook] Error procesando pago MP ${mpPaymentId}`, err);
        throw err;
      } finally {
        await queryRunner.release();
      }
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  /** Confirmación por correo; no debe retrasar ni reabrir la creación de orden. */
  private async sendOrderConfirmationEmail(
    orderId: number,
    emailTo: string,
    customerName: string,
    mpPayment: any,
  ): Promise<void> {
    try {
      const fullOrder = await this.orderRepo.findOne({
        where: { id: orderId },
        relations: ['items', 'items.product'],
      });
      if (!fullOrder || !emailTo) return;

      const groupedItems: Record<number, { productName: string; quantity: number; price: number }> = {};
      for (const item of fullOrder.items) {
        const productId = item.product?.id || 0;
        const productName = item.product?.name || 'Producto';
        const price = item.product?.price || 0;
        if (!groupedItems[productId]) {
          groupedItems[productId] = { productName, quantity: 0, price };
        }
        groupedItems[productId].quantity += 1;
      }

      const emailItems = Object.values(groupedItems);
      const subtotal = emailItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const deliveryNum = Number(fullOrder.deliveryFee) || 0;
      const totalForEmail =
        mpPayment.transaction_amount != null && mpPayment.transaction_amount !== ''
          ? Number(mpPayment.transaction_amount)
          : subtotal + deliveryNum;

      await this.mailService.sendOrderConfirmation(
        emailTo,
        fullOrder.dailyOrderNumber ?? fullOrder.id,
        customerName,
        emailItems,
        totalForEmail,
        String(fullOrder.orderType || 'delivery'),
        fullOrder.address,
        fullOrder.phone,
        deliveryNum > 0 ? deliveryNum : undefined,
      );
    } catch (e) {
      this.logger.warn(`[webhook] Falló correo de orden #${orderId}: ${(e as Error).message}`);
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

  private async notifyWhatsappPaymentSuccess(params: {
    conversationId: number;
    waId: string;
    orderId: number;
  }) {
    try {
      const { WhatsappOrchestratorService } = await import(
        '../whatsapp/whatsapp-orchestrator.service'
      );
      const orch = this.moduleRef.get(WhatsappOrchestratorService, { strict: false });
      if (!orch?.completeAfterMercadoPagoPayment) {
        this.logger.warn('[webhook] WhatsappOrchestratorService no disponible para notificar pago');
        return;
      }
      await orch.completeAfterMercadoPagoPayment(params);
    } catch (err) {
      this.logger.error(
        `[webhook] No se pudo notificar WhatsApp tras pago order=#${params.orderId}`,
        err,
      );
    }
  }
}
