import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { PaymentsService } from './payments.service';
import * as crypto from 'crypto';

interface CreatePreferenceDto {
  orderData: {
    customerName: string;
    phone: string;
    address: string;
    orderType?: 'delivery' | 'pickup' | 'table' | 'counter';
    deliveryFee?: number;
    items: Array<{
      productId: number;
      note?: string;
      attributes?: Array<{
        attributeName: string;
        attributeValue: string;
      }>;
    }>;
  };
  items: Array<{
    title: string;
    quantity: number;
    unit_price: number;
  }>;
  totalAmount: number;
  customerInfo: {
    name: string;
    email: string;
    phone?: string;
  };
}

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Valida la firma del webhook de Mercado Pago
   * @param req - Request object con headers y body
   * @param body - Body del webhook
   * @returns true si la firma es válida, false en caso contrario
   */
  private validateWebhookSignature(req: any, body: any): boolean {
    const webhookSecret = this.configService.get<string>('MERCADO_PAGO_WEBHOOK_SECRET');
    
    if (!webhookSecret) {
      return true; // Permitir en desarrollo sin validación
    }

    const xSignature = req.headers['x-signature'] || req.headers['X-Signature'];
    const xRequestId = req.headers['x-request-id'] || req.headers['X-Request-Id'];

    if (!xSignature || !xRequestId) {
      return false;
    }

    let dataId = body?.data?.id || req.query?.['data.id'] || req.query?.id;
    if (!dataId) {
      return false;
    }

    // Convertir dataId a string y luego a minúsculas (según documentación de Mercado Pago)
    dataId = String(dataId).toLowerCase();

    try {
      // Parsear x-signature: "ts=<timestamp>,v1=<hash>"
      const parts = xSignature.split(',');
      const tsPart = parts.find(p => p.startsWith('ts='));
      const v1Part = parts.find(p => p.startsWith('v1='));

      if (!tsPart || !v1Part) {
        return false;
      }

      const ts = tsPart.split('=')[1];
      const v1 = v1Part.split('=')[1];

      // Construir el manifest según la documentación de Mercado Pago
      // Formato: id:[data.id_lowercase];request-id:[x-request-id];ts:[ts];
      const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;

      // Calcular HMAC-SHA256
      const hmac = crypto
        .createHmac('sha256', webhookSecret)
        .update(manifest)
        .digest('hex');

      // Comparar con v1 (ambos en minúsculas para comparación case-insensitive)
      return hmac.toLowerCase() === v1.toLowerCase();
    } catch {
      return false;
    }
  }

  @Post('create-preference')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create a Mercado Pago payment preference',
    description:
      'Creates a payment preference in Mercado Pago and returns the payment URL.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        orderData: {
          type: 'object',
          description: 'Datos de la orden que se creará después del pago confirmado',
        },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string', example: 'Pollo Broaster' },
              quantity: { type: 'number', example: 2 },
              unit_price: { type: 'number', example: 25000 },
            },
          },
        },
        totalAmount: { type: 'number', example: 50000 },
        customerInfo: {
          type: 'object',
          properties: {
            name: { type: 'string', example: 'Juan Pérez' },
            email: { type: 'string', example: 'juan@example.com' },
            phone: { type: 'string', example: '+573001234567' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Preference created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async createPreference(@Body() createPreferenceDto: CreatePreferenceDto) {
    return this.paymentsService.createPreference(
      createPreferenceDto.orderData,
      createPreferenceDto.items,
      createPreferenceDto.totalAmount,
      createPreferenceDto.customerInfo,
    );
  }

  @Post('webhook')
  @ApiOperation({
    summary: 'Mercado Pago webhook endpoint',
    description: 'Receives webhook notifications from Mercado Pago. Validates webhook signature for security.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        type: { type: 'string', example: 'payment' },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string', example: '12345678901' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid webhook signature' })
  async handleWebhook(@Body() body: any, @Req() req: any) {
    try {
      // Validar firma del webhook
      if (!this.validateWebhookSignature(req, body)) {
        throw new UnauthorizedException('Firma del webhook inválida. Solicitud rechazada por seguridad.');
      }
      // Mercado Pago puede enviar datos de diferentes formas:
      // 1. POST con body: { type: 'payment', data: { id: '123' } }
      // 2. GET con query param: ?id=123
      // 3. POST directo con el ID en el body
      
      let data = body || req.body;
      
      // Si viene el payment_id en query params (método GET de Mercado Pago)
      if (req.query?.id) {
        data = {
          type: 'payment',
          data: { id: req.query.id },
        };
      }
      
      // Si el body viene vacío pero hay query params, intentar construir el objeto
      if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
        if (req.query?.data_id) {
          data = {
            type: 'payment',
            data: { id: req.query.data_id },
          };
        }
      }
      
      if (data && data.type && data.data) {
        return await this.paymentsService.handleWebhook(data);
      }
      
      // Si viene directamente como { id: '123' } sin wrapper
      if (data && data.id && !data.type) {
        return await this.paymentsService.handleWebhook({
          type: 'payment',
          data: { id: data.id },
        });
      }
      
      if (data) {
        return await this.paymentsService.handleWebhook(data);
      }

      return { success: false, message: 'No se recibieron datos válidos del webhook' };
    } catch (error: any) {
      return { success: false, message: error.message || 'Error al procesar el webhook' };
    }
  }

  @Get('status/:orderId')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get payment status for an order',
    description: 'Returns the payment status for a given order ID.',
  })
  @ApiParam({ name: 'orderId', example: 125, description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Payment status retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async getPaymentStatus(@Param('orderId') orderId: string) {
    const orderIdNum = parseInt(orderId, 10);
    return this.paymentsService.getPaymentStatus(orderIdNum);
  }

  @Get('by-preference/:preferenceId')
  @ApiOperation({
    summary: 'Get payment by preference ID',
    description: 'Returns payment information including order status by preference ID. Public endpoint for checkout verification.',
  })
  @ApiParam({ name: 'preferenceId', example: '1234567890', description: 'Mercado Pago Preference ID' })
  @ApiResponse({ status: 200, description: 'Payment information retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async getPaymentByPreference(@Param('preferenceId') preferenceId: string) {
    return this.paymentsService.getPaymentByPreference(preferenceId);
  }

  @Get('by-payment-id/:paymentId')
  @ApiOperation({
    summary: 'Get payment by payment ID',
    description: 'Returns payment information including order status by internal payment ID. Public endpoint for checkout verification.',
  })
  @ApiParam({ name: 'paymentId', example: '1', description: 'Internal Payment ID' })
  @ApiResponse({ status: 200, description: 'Payment information retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async getPaymentById(@Param('paymentId') paymentId: string) {
    const paymentIdNum = parseInt(paymentId, 10);
    return this.paymentsService.getPaymentById(paymentIdNum);
  }
}
