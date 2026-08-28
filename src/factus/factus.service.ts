import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../orders/entities/order.entity';
import {
  CancelElectronicInvoiceDto,
  ResendElectronicInvoiceEmailDto,
} from './dto/factus-actions.dto';
import { IssueElectronicInvoiceDto } from './dto/issue-electronic-invoice.dto';
import { InvoiceCustomer } from './entities/invoice-customer.entity';
import { FactusApiClient } from './factus-api.client';
import { FactusAuthService } from './factus-auth.service';
import { FactusInvoiceMapper } from './factus-invoice.mapper';

@Injectable()
export class FactusService {
  private readonly logger = new Logger(FactusService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(InvoiceCustomer)
    private readonly customerRepo: Repository<InvoiceCustomer>,
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

  async lookupCustomer(docType: string, identification: string) {
    const id = identification.replace(/\D/g, '');
    if (!docType || id.length < 5) return null;
    const row = await this.customerRepo.findOne({
      where: {
        identificationDocumentCode: docType,
        identification: id,
      },
    });
    if (!row) return null;
    return {
      identificationDocumentCode: row.identificationDocumentCode,
      identification: row.identification,
      dv: row.dv,
      legalOrganizationCode: row.legalOrganizationCode,
      names: row.names,
      company: row.company,
      email: row.email,
      phone: row.phone,
      address: row.address,
      municipalityCode: row.municipalityCode,
      timesUsed: row.timesUsed,
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

    const order = await this.loadOrderForInvoice(orderId);

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

    if (order.electronicInvoiceStatus === 'credit_noted') {
      throw new ConflictException({
        message: 'Esta factura ya fue anulada con nota crédito',
        creditNoteNumber: order.electronicCreditNoteNumber,
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
      order.invoiceCustomerDocDv = dto.dv?.trim() || null;
      if (dto.email) order.customerEmail = dto.email;

      await this.orderRepo.save(order);

      if (data?.is_validated) {
        await this.upsertInvoiceCustomer(dto);
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

  async getInvoicePdf(orderId: number): Promise<StreamableFile> {
    this.requireConfigured();
    const order = await this.requireAcceptedInvoice(orderId);
    const { buffer, fileName } = await this.api.downloadBillPdf(
      order.electronicInvoiceNumber!,
    );
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `inline; filename="${fileName}"`,
    });
  }

  async resendInvoiceEmail(orderId: number, dto: ResendElectronicInvoiceEmailDto) {
    this.requireConfigured();
    const order = await this.requireAcceptedInvoice(orderId);
    const email = dto.email.trim();
    this.logger.log(
      `[FE] reenviar email orden=#${orderId} number=${order.electronicInvoiceNumber} → ${email}`,
    );
    const result = await this.api.sendBillEmail(order.electronicInvoiceNumber!, email);
    if (email) {
      order.customerEmail = email;
      await this.orderRepo.save(order);
    }
    return {
      success: true,
      orderId,
      number: order.electronicInvoiceNumber,
      email,
      message: result.message || 'Correo enviado',
    };
  }

  async cancelInvoice(orderId: number, dto: CancelElectronicInvoiceDto) {
    this.requireConfigured();
    const order = await this.loadOrderForInvoice(orderId);

    if (order.electronicInvoiceStatus === 'credit_noted' && order.electronicCreditNoteNumber) {
      throw new ConflictException({
        message: 'Esta factura ya tiene nota crédito',
        creditNoteNumber: order.electronicCreditNoteNumber,
      });
    }

    if (order.electronicInvoiceStatus !== 'accepted' || !order.electronicInvoiceNumber) {
      throw new BadRequestException(
        'Solo se pueden anular facturas electrónicas aceptadas por la DIAN',
      );
    }

    const payload = this.mapper.buildCreditNotePayload(order, {
      observation: dto.observation,
      correctionConceptCode: dto.correctionConceptCode,
    });
    this.logger.log(
      `[FE] nota crédito orden=#${orderId} bill=${payload.bill_number} ref=${payload.reference_code}`,
    );

    try {
      const result = await this.api.validateCreditNote(payload);
      const data = result.data;
      const ok = !!data?.is_validated;

      if (ok) {
        order.electronicInvoiceStatus = 'credit_noted';
        order.electronicCreditNoteNumber = data?.number || null;
        order.electronicCreditNoteCufe = data?.cufe || null;
        order.electronicCreditNotePublicUrl = data?.links?.public_url || null;
        order.electronicCreditNoteIssuedAt = new Date();
        order.electronicInvoiceError = null;
      } else {
        order.electronicInvoiceError = JSON.stringify(
          data?.errors || result.message || 'Nota crédito no validada',
        ).slice(0, 1000);
      }
      await this.orderRepo.save(order);

      if (!ok) {
        this.logger.warn(
          `[FE] NC rechazada orden=#${orderId}: ${result.message} ${JSON.stringify(data?.errors || {})}`,
        );
      } else {
        this.logger.log(
          `[FE] NC OK orden=#${orderId} number=${order.electronicCreditNoteNumber}`,
        );
      }

      return {
        success: ok,
        orderId,
        status: order.electronicInvoiceStatus,
        billNumber: order.electronicInvoiceNumber,
        creditNoteNumber: order.electronicCreditNoteNumber,
        creditNoteCufe: order.electronicCreditNoteCufe,
        creditNotePublicUrl: order.electronicCreditNotePublicUrl,
        message: result.message,
        errors: data?.errors || {},
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`[FE] NC ERROR orden=#${orderId}: ${message}`);
      order.electronicInvoiceError = message.slice(0, 1000);
      await this.orderRepo.save(order);
      throw err;
    }
  }

  private async upsertInvoiceCustomer(dto: IssueElectronicInvoiceDto) {
    const identification = dto.identification.replace(/\D/g, '');
    try {
      const existing = await this.customerRepo.findOne({
        where: {
          identificationDocumentCode: dto.identificationDocumentCode,
          identification,
        },
      });
      if (existing) {
        existing.dv = dto.dv?.trim() || existing.dv;
        existing.legalOrganizationCode = dto.legalOrganizationCode;
        existing.names = dto.names?.trim() || existing.names;
        existing.company = dto.company?.trim() || existing.company;
        existing.email = dto.email?.trim() || existing.email;
        existing.phone = dto.phone?.replace(/\D/g, '').slice(-10) || existing.phone;
        existing.address = dto.address?.trim() || existing.address;
        existing.municipalityCode = dto.municipalityCode?.trim() || existing.municipalityCode;
        existing.timesUsed = (existing.timesUsed || 0) + 1;
        await this.customerRepo.save(existing);
        return;
      }
      await this.customerRepo.save(
        this.customerRepo.create({
          identificationDocumentCode: dto.identificationDocumentCode,
          identification,
          dv: dto.dv?.trim() || null,
          legalOrganizationCode: dto.legalOrganizationCode,
          names: dto.names?.trim() || null,
          company: dto.company?.trim() || null,
          email: dto.email?.trim() || null,
          phone: dto.phone?.replace(/\D/g, '').slice(-10) || null,
          address: dto.address?.trim() || null,
          municipalityCode: dto.municipalityCode?.trim() || null,
          timesUsed: 1,
        }),
      );
    } catch (err) {
      this.logger.warn(
        `[FE] no se pudo guardar cliente fiscal: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  private async loadOrderForInvoice(orderId: number): Promise<Order> {
    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: ['items', 'items.product', 'items.attributes', 'extras'],
    });
    if (!order) {
      this.logger.warn(`[FE] orden #${orderId} no encontrada`);
      throw new NotFoundException('Orden no encontrada');
    }
    return order;
  }

  private async requireAcceptedInvoice(orderId: number): Promise<Order> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Orden no encontrada');
    if (
      (order.electronicInvoiceStatus !== 'accepted' &&
        order.electronicInvoiceStatus !== 'credit_noted') ||
      !order.electronicInvoiceNumber
    ) {
      throw new BadRequestException('La orden no tiene factura electrónica aceptada');
    }
    return order;
  }

  private requireConfigured() {
    if (!this.auth.isConfigured()) {
      throw new BadRequestException(
        'Facturación electrónica no configurada. Pide a un admin cargar las credenciales Factus.',
      );
    }
  }

  private isDebug(): boolean {
    return (process.env.FACTUS_DEBUG || '').toLowerCase() === 'true';
  }
}
