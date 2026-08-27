import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../orders/entities/order.entity';
import { IssueElectronicInvoiceDto } from './dto/issue-electronic-invoice.dto';
import { FactusApiClient } from './factus-api.client';
import { FactusAuthService } from './factus-auth.service';
import { FactusInvoiceMapper } from './factus-invoice.mapper';

export type ElectronicInvoiceStatus =
  | 'none'
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'error';

@Injectable()
export class FactusService {
  private readonly logger = new Logger(FactusService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    private readonly auth: FactusAuthService,
    private readonly api: FactusApiClient,
    private readonly mapper: FactusInvoiceMapper,
  ) {}

  getStatus(): {
    configured: boolean;
    env: string;
    baseUrl: string;
  } {
    const env = (process.env.FACTUS_ENV || 'sandbox').toLowerCase();
    return {
      configured: this.auth.isConfigured(),
      env,
      baseUrl: this.auth.getBaseUrl(),
    };
  }

  async issueForOrder(orderId: number, dto: IssueElectronicInvoiceDto) {
    const debug = this.isDebug();
    this.logger.log(
      `[FE] inicio orden=#${orderId} env=${process.env.FACTUS_ENV || 'sandbox'} ` +
        `doc=${dto.identificationDocumentCode}:${dto.identification} ` +
        `persona=${dto.legalOrganizationCode}`,
    );

    if (!this.auth.isConfigured()) {
      this.logger.error('[FE] Factus no configurado (faltan FACTUS_* en .env)');
      throw new BadRequestException(
        'Facturación electrónica no configurada. Pide a un admin cargar las credenciales Factus.',
      );
    }

    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: ['items', 'items.product', 'items.attributes', 'extras'],
    });
    if (!order) {
      this.logger.warn(`[FE] orden #${orderId} no encontrada`);
      throw new NotFoundException('Orden no encontrada');
    }

    if (order.orderStatus === 'canceled') {
      this.logger.warn(`[FE] orden #${orderId} anulada — no facturable`);
      throw new BadRequestException('No se puede facturar una orden anulada');
    }

    if (order.electronicInvoiceStatus === 'accepted' && order.electronicInvoiceNumber) {
      this.logger.warn(
        `[FE] orden #${orderId} ya facturada → ${order.electronicInvoiceNumber}`,
      );
      throw new ConflictException({
        message: 'Esta orden ya tiene factura electrónica',
        number: order.electronicInvoiceNumber,
        cufe: order.electronicInvoiceCufe,
        publicUrl: order.electronicInvoicePublicUrl,
      });
    }

    if (!order.items?.length && !order.extras?.length) {
      this.logger.warn(`[FE] orden #${orderId} sin ítems`);
      throw new BadRequestException('La orden no tiene ítems para facturar');
    }

    if (dto.legalOrganizationCode === '2' && !dto.names?.trim() && !order.customerName?.trim()) {
      throw new BadRequestException('Indica el nombre del cliente');
    }
    if (dto.legalOrganizationCode === '1' && !dto.company?.trim()) {
      throw new BadRequestException('Indica la razón social');
    }

    order.electronicInvoiceStatus = 'pending';
    order.electronicInvoiceError = null;
    order.electronicInvoiceReference = `PPP-ORD-${order.id}`;
    await this.orderRepo.save(order);

    const { payload, invoiceTotal } = this.mapper.buildValidatePayload(order, dto);
    this.logger.log(
      `[FE] payload listo orden=#${order.id} ref=${payload.reference_code} ` +
        `items=${payload.items?.length ?? 0} total≈${invoiceTotal} ` +
        `cliente=${payload.customer?.names || payload.customer?.company || '?'}`,
    );
    if (debug) {
      this.logger.debug(`[FE] payload completo: ${JSON.stringify(payload)}`);
    }

    try {
      const result = await this.api.validateBill(payload);
      const data = result.data;

      order.electronicInvoiceStatus = data?.is_validated ? 'accepted' : 'rejected';
      order.electronicInvoiceNumber = data?.number || null;
      order.electronicInvoiceCufe = data?.cufe || null;
      order.electronicInvoicePublicUrl = data?.links?.public_url || null;
      order.electronicInvoiceQrUrl = data?.links?.qr || null;
      order.electronicInvoiceIssuedAt = new Date();
      order.electronicInvoiceError = data?.is_validated
        ? null
        : JSON.stringify(data?.errors || result.message || 'No validada').slice(0, 1000);

      order.invoiceCustomerDocType = dto.identificationDocumentCode;
      order.invoiceCustomerDocNumber = dto.identification.replace(/\D/g, '');
      if (dto.email) order.customerEmail = dto.email;

      await this.orderRepo.save(order);

      if (data?.is_validated) {
        this.logger.log(
          `[FE] OK orden=#${order.id} number=${order.electronicInvoiceNumber} ` +
            `cufe=${(order.electronicInvoiceCufe || '').slice(0, 24)}… ` +
            `url=${order.electronicInvoicePublicUrl || '-'}`,
        );
      } else {
        this.logger.warn(
          `[FE] RECHAZADA/sin validar orden=#${order.id} number=${order.electronicInvoiceNumber} ` +
            `msg=${result.message} errors=${JSON.stringify(data?.errors || {})}`,
        );
      }

      if (debug && data?.errors && Object.keys(data.errors).length) {
        this.logger.debug(`[FE] avisos DIAN: ${JSON.stringify(data.errors)}`);
      }

      return {
        success: !!data?.is_validated,
        orderId: order.id,
        status: order.electronicInvoiceStatus,
        number: order.electronicInvoiceNumber,
        cufe: order.electronicInvoiceCufe,
        publicUrl: order.electronicInvoicePublicUrl,
        qrUrl: order.electronicInvoiceQrUrl,
        message: result.message,
        errors: data?.errors || {},
        totals: data?.totals,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      this.logger.error(
        `[FE] ERROR orden=#${order.id} ref=${payload.reference_code}: ${message}`,
        stack,
      );
      order.electronicInvoiceStatus = 'error';
      order.electronicInvoiceError = message.slice(0, 1000);
      await this.orderRepo.save(order);
      throw err;
    }
  }

  private isDebug(): boolean {
    return (process.env.FACTUS_DEBUG || '').toLowerCase() === 'true';
  }
}
