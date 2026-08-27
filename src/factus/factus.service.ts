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
    if (!this.auth.isConfigured()) {
      throw new BadRequestException(
        'Facturación electrónica no configurada. Pide a un admin cargar las credenciales Factus.',
      );
    }

    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: ['items', 'items.product', 'items.attributes', 'extras'],
    });
    if (!order) throw new NotFoundException('Orden no encontrada');

    if (order.orderStatus === 'canceled') {
      throw new BadRequestException('No se puede facturar una orden anulada');
    }

    if (order.electronicInvoiceStatus === 'accepted' && order.electronicInvoiceNumber) {
      throw new ConflictException({
        message: 'Esta orden ya tiene factura electrónica',
        number: order.electronicInvoiceNumber,
        cufe: order.electronicInvoiceCufe,
        publicUrl: order.electronicInvoicePublicUrl,
      });
    }

    if (!order.items?.length && !order.extras?.length) {
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

    const { payload } = this.mapper.buildValidatePayload(order, dto);

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

      // Guardar datos fiscales del cliente en la orden para reintentos / auditoría
      order.invoiceCustomerDocType = dto.identificationDocumentCode;
      order.invoiceCustomerDocNumber = dto.identification.replace(/\D/g, '');
      if (dto.email) order.customerEmail = dto.email;

      await this.orderRepo.save(order);

      this.logger.log(
        `FE orden #${order.id} → ${order.electronicInvoiceNumber} validated=${data?.is_validated}`,
      );

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
      order.electronicInvoiceStatus = 'error';
      order.electronicInvoiceError = message.slice(0, 1000);
      await this.orderRepo.save(order);
      throw err;
    }
  }
}
