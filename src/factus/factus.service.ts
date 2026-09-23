import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Order } from '../orders/entities/order.entity';
import { ProductsService } from '../products/products.service';
import {
  CancelElectronicInvoiceDto,
  ResendElectronicInvoiceEmailDto,
} from './dto/factus-actions.dto';
import { IssueElectronicInvoiceDto } from './dto/issue-electronic-invoice.dto';
import {
  BulkElectronicInvoiceIssueDto,
  BulkElectronicInvoicePreviewDto,
} from './dto/bulk-electronic-invoice.dto';
import { InvoiceCustomer } from './entities/invoice-customer.entity';
import { FactusStandaloneInvoice } from './entities/factus-standalone-invoice.entity';
import { FactusApiClient } from './factus-api.client';
import { FactusAuthService } from './factus-auth.service';
import { FactusInvoiceMapper } from './factus-invoice.mapper';
import { FactusInvoiceSettingsService } from './factus-invoice-settings.service';
import {
  applyInvoiceCustomerSearchFilter,
  escapeLikePattern,
  invoiceCustomerTextSearchSql,
  updateInvoiceCustomerRow,
} from './factus-invoice-customer.util';
import type { UpdateInvoiceCustomerDto } from './dto/update-invoice-customer.dto';
import {
  invoiceCustomerDisplayName,
  resolveLegalOrganizationFromDocType,
} from './factus-customer.utils';
import { pickCreditNoteRangeId } from './factus-numbering.util';
import type {
  FactusBillDetail,
  FactusBillListItem,
  FactusValidateCreditNoteRequest,
} from './types/factus.types';
import {
  planBulkInvoicesFromCatalog,
  type BulkInvoicePlan,
} from './factus-bulk-select.util';
import {
  formatToBogotaISO,
  getBogotaDateRange,
} from '../common/utils/date.util';

/** Adquiriente genérico DIAN para emisión en lote. */
const BULK_CONSUMIDOR_FINAL: IssueElectronicInvoiceDto = {
  identificationDocumentCode: '13',
  identification: '222222222222',
  legalOrganizationCode: '2',
  names: 'Consumidor final',
  sendEmail: false,
};

type FactusValidationOutcome = {
  status: 'accepted' | 'pending' | 'rejected';
  /** Solo mensaje de fallo real; null si aceptada o en proceso OK. */
  error: string | null;
  info: string | null;
};

type InvoiceCustomerRow = {
  identificationDocumentCode: string;
  identification: string;
  dv: string | null;
  legalOrganizationCode: string;
  names: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  municipalityCode: string | null;
  timesUsed: number;
  updatedAt?: Date;
};

@Injectable()
export class FactusService {
  private readonly logger = new Logger(FactusService.name);
  /** Cache del rango NC auto-detectado (como Loggro: sin obligar .env si hay uno solo). */
  private creditNoteRangeCache: { id: number; expiresAt: number } | null = null;
  private static readonly NC_RANGE_CACHE_MS = 10 * 60 * 1000;

  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(InvoiceCustomer)
    private readonly customerRepo: Repository<InvoiceCustomer>,
    @InjectRepository(FactusStandaloneInvoice)
    private readonly standaloneInvoiceRepo: Repository<FactusStandaloneInvoice>,
    private readonly config: ConfigService,
    private readonly auth: FactusAuthService,
    private readonly api: FactusApiClient,
    private readonly mapper: FactusInvoiceMapper,
    private readonly invoiceSettings: FactusInvoiceSettingsService,
    private readonly productsService: ProductsService,
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
    return this.toInvoiceCustomerDto(row);
  }

  async searchCustomers(query: string, limit = 10) {
    const q = query.trim();
    if (q.length < 2) return [];
    const pattern = `%${escapeLikePattern(q)}%`;
    const idDigits = q.replace(/\D/g, '');
    const qb = this.customerRepo.createQueryBuilder('c');
    if (idDigits.length >= 3) {
      qb.where(
        `(${invoiceCustomerTextSearchSql('c')} OR c.identification LIKE :idPattern)`,
        { pattern, idPattern: `%${idDigits}%` },
      );
    } else {
      qb.where(invoiceCustomerTextSearchSql('c'), { pattern });
    }
    const rows = await qb
      .orderBy('c.times_used', 'DESC')
      .addOrderBy('c.updated_at', 'DESC')
      .take(Math.min(Math.max(limit, 1), 20))
      .getMany();
    return rows.map((row) => this.toInvoiceCustomerDto(row));
  }

  async listCustomersAdmin(page = 1, limit = 50, search?: string) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const qb = this.customerRepo.createQueryBuilder('c');
    if (search?.trim()) {
      applyInvoiceCustomerSearchFilter(qb, search);
    }
    qb.orderBy('c.times_used', 'DESC').addOrderBy('c.updated_at', 'DESC');
    const [rows, total] = await qb
      .skip((safePage - 1) * safeLimit)
      .take(safeLimit)
      .getManyAndCount();
    return {
      data: rows.map((row) => ({
        id: row.id,
        ...this.toInvoiceCustomerDto(row),
        displayName: invoiceCustomerDisplayName(row),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })),
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
    };
  }

  async updateCustomerAdmin(id: number, dto: UpdateInvoiceCustomerDto) {
    const row = await updateInvoiceCustomerRow(this.customerRepo, id, dto);
    return {
      id: row.id,
      ...this.toInvoiceCustomerDto(row),
      displayName: invoiceCustomerDisplayName(row),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private toInvoiceCustomerDto(row: InvoiceCustomer): InvoiceCustomerRow {
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
      updatedAt: row.updatedAt,
    };
  }

  private normalizeIssueDto(dto: IssueElectronicInvoiceDto): IssueElectronicInvoiceDto {
    const legalOrganizationCode =
      dto.legalOrganizationCode ||
      resolveLegalOrganizationFromDocType(dto.identificationDocumentCode);
    return { ...dto, legalOrganizationCode };
  }

  async issueForOrder(orderId: number, rawDto: IssueElectronicInvoiceDto) {
    const dto = this.normalizeIssueDto(rawDto);
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

    const taxConfig = await this.invoiceSettings.getResolvedTaxConfig();
    const { payload, invoiceTotal } = this.mapper.buildValidatePayload(order, dto, taxConfig);
    this.logger.log(
      `[FE] payload listo orden=#${order.id} ref=${payload.reference_code} ` +
        `items=${payload.items?.length ?? 0} total≈${invoiceTotal} ` +
        `impuestos=${taxConfig.source} ` +
        `cliente=${payload.customer?.names || payload.customer?.company || '?'}`,
    );
    if (debug) {
      this.logger.debug(`[FE] payload completo: ${JSON.stringify(payload)}`);
    }

    try {
      const result = await this.api.validateBill(payload);
      const data = result.data;
      const outcome = this.resolveFactusValidationOutcome({
        isValidated: data?.is_validated,
        number: data?.number,
        message: result.message,
        errors: data?.errors,
      });

      order.electronicInvoiceStatus = outcome.status;
      order.electronicInvoiceNumber = data?.number || null;
      order.electronicInvoiceCufe = data?.cufe || null;
      order.electronicInvoicePublicUrl = data?.links?.public_url || null;
      order.electronicInvoiceQrUrl = data?.links?.qr || null;
      order.electronicInvoiceIssuedAt = new Date();
      order.electronicInvoiceError = outcome.error ?? outcome.info;

      order.invoiceCustomerDocType = dto.identificationDocumentCode;
      order.invoiceCustomerDocNumber = dto.identification.replace(/\D/g, '');
      order.invoiceCustomerDocDv = dto.dv?.trim() || null;
      if (dto.email) order.customerEmail = dto.email;

      await this.orderRepo.save(order);

      if (outcome.status === 'accepted') {
        await this.upsertInvoiceCustomer(dto);
        this.logger.log(
          `[FE] OK orden=#${order.id} number=${order.electronicInvoiceNumber} ` +
            `cufe=${(order.electronicInvoiceCufe || '').slice(0, 24)}… ` +
            `url=${order.electronicInvoicePublicUrl || '-'}`,
        );
      } else if (outcome.status === 'pending') {
        this.logger.log(
          `[FE] PENDIENTE DIAN orden=#${order.id} number=${order.electronicInvoiceNumber} msg=${result.message}`,
        );
      } else {
        this.logger.warn(
          `[FE] RECHAZADA orden=#${order.id} number=${order.electronicInvoiceNumber} ` +
            `msg=${result.message} errors=${JSON.stringify(data?.errors || {})}`,
        );
      }

      if (debug && data?.errors && Object.keys(data.errors).length) {
        this.logger.debug(`[FE] avisos DIAN: ${JSON.stringify(data.errors)}`);
      }

      return {
        success: outcome.status === 'accepted',
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

    let savedCustomer: InvoiceCustomer | null = null;
    if (order.invoiceCustomerDocType && order.invoiceCustomerDocNumber) {
      savedCustomer = await this.customerRepo.findOne({
        where: {
          identificationDocumentCode: order.invoiceCustomerDocType,
          identification: order.invoiceCustomerDocNumber.replace(/\D/g, ''),
        },
      });
    }

    const taxConfig = await this.invoiceSettings.getResolvedTaxConfig();
    const payload = this.mapper.buildCreditNotePayload(order, {
      observation: dto.observation,
      correctionConceptCode: dto.correctionConceptCode,
      savedCustomer,
      numberingRangeId: await this.resolveCreditNoteRangeId(),
      taxConfig,
    });
    await this.ensureCreditNoteCustomer(payload, order);
    this.logger.log(
      `[FE] nota crédito orden=#${orderId} bill=${payload.bill_number} ref=${payload.reference_code} ` +
        `cliente=${payload.customer.identification_document_code}:${payload.customer.identification}`,
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
    const legalOrganizationCode =
      dto.legalOrganizationCode ||
      resolveLegalOrganizationFromDocType(dto.identificationDocumentCode);
    try {
      const existing = await this.customerRepo.findOne({
        where: {
          identificationDocumentCode: dto.identificationDocumentCode,
          identification,
        },
      });
      if (existing) {
        existing.dv = dto.dv?.trim() || existing.dv;
        existing.legalOrganizationCode = legalOrganizationCode;
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
          legalOrganizationCode,
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

  /**
   * Rango NC: FACTUS_CREDIT_NOTE_RANGE_ID o auto-detecta vía GET /v2/numbering-ranges
   * (mismo criterio que software tipo Loggro cuando no configuras NC a mano).
   */
  /**
   * Factus exige customer completo en NC. Si PPP no lo tiene en BD,
   * lo tomamos de GET /v2/bills/:number (misma FE ya validada).
   */
  private async ensureCreditNoteCustomer(
    payload: FactusValidateCreditNoteRequest,
    order: Order,
  ): Promise<void> {
    const c = payload.customer;
    const id = c?.identification?.replace(/\D/g, '') || '';
    const complete =
      id.length >= 5 &&
      !!c?.identification_document_code &&
      !!c?.legal_organization_code &&
      Array.isArray(c?.responsibilities) &&
      c.responsibilities.length > 0;

    if (complete) return;

    if (!order.electronicInvoiceNumber) {
      throw new BadRequestException('La orden no tiene número de factura electrónica');
    }

    this.logger.log(
      `[FE] NC cliente incompleto orden=#${order.id} — consultando ${order.electronicInvoiceNumber} en Factus`,
    );
    const bill = await this.api.getBill(order.electronicInvoiceNumber);
    payload.customer = this.mapper.customerFromBillDetail(bill);
  }

  private async resolveCreditNoteRangeId(): Promise<number> {
    const fromEnv = this.config.get<string>('FACTUS_CREDIT_NOTE_RANGE_ID');
    const parsed = fromEnv ? parseInt(fromEnv, 10) : NaN;
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }

    const now = Date.now();
    if (
      this.creditNoteRangeCache &&
      this.creditNoteRangeCache.expiresAt > now
    ) {
      return this.creditNoteRangeCache.id;
    }

    const billRangeRaw = this.config.get<string>('FACTUS_NUMBERING_RANGE_ID');
    const billRangeId = billRangeRaw ? parseInt(billRangeRaw, 10) : undefined;

    const ranges = await this.api.listNumberingRanges();
    const id = pickCreditNoteRangeId(ranges, billRangeId);
    this.logger.log(`[FE] rango NC auto-detectado → id=${id}`);
    this.creditNoteRangeCache = {
      id,
      expiresAt: now + FactusService.NC_RANGE_CACHE_MS,
    };
    return id;
  }

  private isDebug(): boolean {
    return (process.env.FACTUS_DEBUG || '').toLowerCase() === 'true';
  }

  /**
   * Preview: reparte productos del catálogo en N facturas con montos desiguales
   * que suman ≈ targetTotal (sin atarse a órdenes del día).
   */
  async previewBulkElectronicInvoices(dto: BulkElectronicInvoicePreviewDto) {
    const catalog = await this.loadBulkCatalogProducts();
    const plan = planBulkInvoicesFromCatalog(
      Math.round(dto.targetTotal),
      dto.quantity,
      catalog,
      dto.maxDeviationRatio ?? 0.08,
    );
    return {
      ...plan,
      catalogSize: catalog.length,
    };
  }

  /**
   * Emite N FE a Factus (consumidor final) desde el plan de catálogo.
   * No crea órdenes PPP.
   */
  async issueBulkElectronicInvoices(dto: BulkElectronicInvoiceIssueDto) {
    if (!this.auth.isConfigured()) {
      throw new BadRequestException(
        'Facturación electrónica no configurada. Pide a un admin cargar las credenciales Factus.',
      );
    }

    let invoices: BulkInvoicePlan[] = dto.invoices || [];

    if (!invoices.length) {
      if (dto.targetTotal == null || dto.quantity == null) {
        throw new BadRequestException(
          'Envía el plan (invoices) o targetTotal + quantity para regenerarlo',
        );
      }
      const catalog = await this.loadBulkCatalogProducts();
      const plan = planBulkInvoicesFromCatalog(
        Math.round(dto.targetTotal),
        dto.quantity,
        catalog,
        dto.maxDeviationRatio ?? 0.08,
      );
      invoices = plan.invoices;
    }

    if (!invoices.length) {
      throw new BadRequestException('No hay facturas para emitir');
    }
    if (invoices.length > 40) {
      throw new BadRequestException('Máximo 40 facturas por lote');
    }
    for (const inv of invoices) {
      if (!inv.lines?.length) {
        throw new BadRequestException(`La factura #${inv.index} no tiene productos`);
      }
    }

    const issueDto: IssueElectronicInvoiceDto = {
      ...BULK_CONSUMIDOR_FINAL,
      sendEmail: dto.sendEmail === true,
      paymentMethodCode: dto.paymentMethodCode,
      observation: dto.observation?.slice(0, 250) || 'Lote FE admin (catálogo)',
    };

    const taxConfig = await this.invoiceSettings.getResolvedTaxConfig();
    const batchId = `lote-${Date.now()}`;
    const results: Array<{
      index: number;
      ok: boolean;
      sum?: number;
      number?: string | null;
      cufe?: string | null;
      publicUrl?: string | null;
      error?: string;
    }> = [];

    for (const inv of invoices) {
      try {
        const referenceCode = `PPP-LOTE-${batchId}-${inv.index}`.slice(0, 100);
        const { payload, invoiceTotal } = this.mapper.buildValidatePayloadFromCatalogLines(
          inv.lines,
          issueDto,
          taxConfig,
          {
            referenceCode,
            observation: issueDto.observation,
          },
        );
        this.logger.log(
          `[FE bulk] #${inv.index} ref=${referenceCode} items=${payload.items.length} total≈${invoiceTotal}`,
        );

        const result = await this.api.validateBill(payload);
        const data = result.data;
        const outcome = this.resolveFactusValidationOutcome({
          isValidated: data?.is_validated,
          number: data?.number,
          message: result.message,
          errors: data?.errors,
        });
        const linesJson = JSON.stringify(inv.lines);

        if (outcome.status === 'accepted') {
          await this.upsertInvoiceCustomer(issueDto);
          await this.standaloneInvoiceRepo.save(
            this.standaloneInvoiceRepo.create({
              batchId,
              batchIndex: inv.index,
              referenceCode,
              customerName: issueDto.names || 'Consumidor final',
              invoiceStatus: 'accepted',
              invoiceNumber: data?.number ?? null,
              invoiceCufe: data?.cufe ?? null,
              publicUrl: data?.links?.public_url ?? null,
              qrUrl: (data?.links as { qr_url?: string } | undefined)?.qr_url ?? null,
              issuedAt: new Date(),
              plannedSum: inv.sum,
              linesJson,
              invoiceCustomerDocType: issueDto.identificationDocumentCode,
              invoiceCustomerDocNumber: issueDto.identification,
            }),
          );
          results.push({
            index: inv.index,
            ok: true,
            sum: inv.sum,
            number: data?.number ?? null,
            cufe: data?.cufe ?? null,
            publicUrl: data?.links?.public_url ?? null,
          });
        } else if (outcome.status === 'pending') {
          await this.standaloneInvoiceRepo.save(
            this.standaloneInvoiceRepo.create({
              batchId,
              batchIndex: inv.index,
              referenceCode,
              customerName: issueDto.names || 'Consumidor final',
              invoiceStatus: 'pending',
              invoiceNumber: data?.number ?? null,
              invoiceCufe: data?.cufe ?? null,
              publicUrl: data?.links?.public_url ?? null,
              qrUrl: (data?.links as { qr_url?: string } | undefined)?.qr_url ?? null,
              issuedAt: data?.number ? new Date() : null,
              invoiceError: outcome.info,
              plannedSum: inv.sum,
              linesJson,
              invoiceCustomerDocType: issueDto.identificationDocumentCode,
              invoiceCustomerDocNumber: issueDto.identification,
            }),
          );
          results.push({
            index: inv.index,
            ok: false,
            sum: inv.sum,
            number: data?.number ?? null,
            error: outcome.info || 'En validación DIAN',
          });
        } else {
          await this.standaloneInvoiceRepo.save(
            this.standaloneInvoiceRepo.create({
              batchId,
              batchIndex: inv.index,
              referenceCode,
              customerName: issueDto.names || 'Consumidor final',
              invoiceStatus: 'rejected',
              invoiceNumber: data?.number ?? null,
              invoiceError: outcome.error,
              plannedSum: inv.sum,
              linesJson,
              invoiceCustomerDocType: issueDto.identificationDocumentCode,
              invoiceCustomerDocNumber: issueDto.identification,
            }),
          );
          results.push({
            index: inv.index,
            ok: false,
            sum: inv.sum,
            number: data?.number ?? null,
            error: outcome.error || 'Rechazada',
          });
        }
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : typeof err === 'object' && err && 'message' in err
              ? String((err as { message: unknown }).message)
              : 'Error al emitir';
        this.logger.warn(`[FE bulk] factura #${inv.index} falló: ${message}`);
        const referenceCode = `PPP-LOTE-${batchId}-${inv.index}`.slice(0, 100);
        await this.standaloneInvoiceRepo.save(
          this.standaloneInvoiceRepo.create({
            batchId,
            batchIndex: inv.index,
            referenceCode,
            customerName: issueDto.names || 'Consumidor final',
            invoiceStatus: 'error',
            invoiceError: message.slice(0, 1000),
            plannedSum: inv.sum,
            linesJson: JSON.stringify(inv.lines),
            invoiceCustomerDocType: issueDto.identificationDocumentCode,
            invoiceCustomerDocNumber: issueDto.identification,
          }),
        );
        results.push({ index: inv.index, ok: false, sum: inv.sum, error: message });
      }
    }

    const okCount = results.filter((r) => r.ok).length;
    return {
      total: results.length,
      okCount,
      failCount: results.length - okCount,
      results,
    };
  }

  /**
   * Listado admin: FE ligadas a órdenes + FE de lote (standalone).
   */
  async findElectronicInvoicesForAdmin(opts: {
    from: string;
    to: string;
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
    exportMode?: boolean;
  }): Promise<{
    from: string;
    to: string;
    page: number;
    limit: number;
    total: number;
    summary: Record<string, number>;
    items: Array<Record<string, unknown>>;
  }> {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(opts.from) || !dateRegex.test(opts.to)) {
      throw new BadRequestException('from/to deben ser YYYY-MM-DD');
    }
    if (opts.from > opts.to) {
      throw new BadRequestException('from no puede ser mayor que to');
    }

    const { start } = getBogotaDateRange(opts.from);
    const { end } = getBogotaDateRange(opts.to);
    const page = Math.max(1, opts.page || 1);
    const limit = opts.exportMode
      ? Math.min(10_000, Math.max(1, opts.limit || 10_000))
      : Math.min(100, Math.max(1, opts.limit || 25));
    const status = (opts.status || 'all').trim().toLowerCase();
    const search = opts.search?.trim() || '';

    const orderBaseQb = () => {
      const qb = this.orderRepo
        .createQueryBuilder('o')
        .where('o.electronicInvoiceStatus IS NOT NULL')
        .andWhere("o.electronicInvoiceStatus != :none", { none: 'none' })
        .andWhere(
          `(
            (o.electronicInvoiceIssuedAt IS NOT NULL AND o.electronicInvoiceIssuedAt BETWEEN :start AND :end)
            OR (o.electronicInvoiceIssuedAt IS NULL AND o.createdAt BETWEEN :start AND :end)
          )`,
          { start, end },
        );
      if (status && status !== 'all') {
        qb.andWhere('o.electronicInvoiceStatus = :status', { status });
      }
      if (search) {
        const like = `%${search}%`;
        qb.andWhere(
          `(
            o.electronicInvoiceNumber LIKE :like
            OR o.electronicCreditNoteNumber LIKE :like
            OR o.customerName LIKE :like
            OR o.invoiceCustomerDocNumber LIKE :like
            OR CAST(o.dailyOrderNumber AS CHAR) LIKE :like
            OR CAST(o.id AS CHAR) LIKE :like
          )`,
          { like },
        );
      }
      return qb;
    };

    const standaloneBaseQb = () => {
      const qb = this.standaloneInvoiceRepo
        .createQueryBuilder('s')
        .where(
          `(
            (s.issuedAt IS NOT NULL AND s.issuedAt BETWEEN :start AND :end)
            OR (s.issuedAt IS NULL AND s.createdAt BETWEEN :start AND :end)
          )`,
          { start, end },
        );
      if (status && status !== 'all') {
        qb.andWhere('s.invoiceStatus = :status', { status });
      }
      if (search) {
        const like = `%${search}%`;
        qb.andWhere(
          `(
            s.invoiceNumber LIKE :like
            OR s.referenceCode LIKE :like
            OR s.customerName LIKE :like
            OR s.invoiceCustomerDocNumber LIKE :like
            OR CAST(s.batchIndex AS CHAR) LIKE :like
            OR s.batchId LIKE :like
          )`,
          { like },
        );
      }
      return qb;
    };

    const summary: Record<string, number> = {
      accepted: 0,
      credit_noted: 0,
      rejected: 0,
      error: 0,
      pending: 0,
      total: 0,
    };

    const orderSummaryRows: Array<{ status: string; c: string }> = await orderBaseQb()
      .select('o.electronicInvoiceStatus', 'status')
      .addSelect('COUNT(*)', 'c')
      .groupBy('o.electronicInvoiceStatus')
      .getRawMany();
    for (const row of orderSummaryRows) {
      const n = Number(row.c) || 0;
      summary[row.status] = (summary[row.status] || 0) + n;
      summary.total += n;
    }

    const standaloneSummaryRows: Array<{ status: string; c: string }> =
      await standaloneBaseQb()
        .select('s.invoiceStatus', 'status')
        .addSelect('COUNT(*)', 'c')
        .groupBy('s.invoiceStatus')
        .getRawMany();
    for (const row of standaloneSummaryRows) {
      const n = Number(row.c) || 0;
      summary[row.status] = (summary[row.status] || 0) + n;
      summary.total += n;
    }

    const orders = await orderBaseQb()
      .orderBy('COALESCE(o.electronic_invoice_issued_at, o.created_at)', 'DESC')
      .getMany();
    const standalones = await standaloneBaseQb()
      .orderBy('COALESCE(s.issued_at, s.created_at)', 'DESC')
      .getMany();

    const orderItems = orders.map((o) => ({
      source: 'order' as const,
      orderId: o.id,
      dailyOrderNumber: o.dailyOrderNumber,
      referenceCode: o.electronicInvoiceReference ?? `PPP-ORD-${o.id}`,
      customerName: o.customerName,
      phone: o.phone,
      orderType: o.orderType,
      orderStatus: o.orderStatus,
      createdAt: formatToBogotaISO(o.createdAt),
      electronicInvoiceStatus: o.electronicInvoiceStatus ?? 'none',
      electronicInvoiceNumber: o.electronicInvoiceNumber ?? null,
      electronicInvoiceCufe: o.electronicInvoiceCufe ?? null,
      electronicInvoicePublicUrl: o.electronicInvoicePublicUrl ?? null,
      electronicInvoiceQrUrl: o.electronicInvoiceQrUrl ?? null,
      electronicInvoiceIssuedAt: formatToBogotaISO(o.electronicInvoiceIssuedAt),
      electronicInvoiceError: o.electronicInvoiceError ?? null,
      electronicCreditNoteNumber: o.electronicCreditNoteNumber ?? null,
      electronicCreditNoteCufe: o.electronicCreditNoteCufe ?? null,
      electronicCreditNotePublicUrl: o.electronicCreditNotePublicUrl ?? null,
      electronicCreditNoteIssuedAt: formatToBogotaISO(o.electronicCreditNoteIssuedAt),
      invoiceCustomerDocType: o.invoiceCustomerDocType ?? null,
      invoiceCustomerDocNumber: o.invoiceCustomerDocNumber ?? null,
      invoiceCustomerDocDv: o.invoiceCustomerDocDv ?? null,
      customerEmail: o.customerEmail ?? null,
      _sortAt: o.electronicInvoiceIssuedAt ?? o.createdAt,
    }));

    const bulkItems = standalones.map((s) => ({
      source: 'bulk' as const,
      bulkInvoiceId: s.id,
      batchId: s.batchId,
      batchIndex: s.batchIndex,
      referenceCode: s.referenceCode,
      orderId: null as number | null,
      dailyOrderNumber: null as number | null,
      customerName: s.customerName,
      phone: null as string | null,
      orderType: 'bulk',
      orderStatus: '—',
      createdAt: formatToBogotaISO(s.createdAt),
      electronicInvoiceStatus: s.invoiceStatus,
      electronicInvoiceNumber: s.invoiceNumber,
      electronicInvoiceCufe: s.invoiceCufe,
      electronicInvoicePublicUrl: s.publicUrl,
      electronicInvoiceQrUrl: s.qrUrl,
      electronicInvoiceIssuedAt: formatToBogotaISO(s.issuedAt),
      electronicInvoiceError: s.invoiceError,
      electronicCreditNoteNumber: null,
      electronicCreditNoteCufe: null,
      electronicCreditNotePublicUrl: null,
      electronicCreditNoteIssuedAt: null,
      invoiceCustomerDocType: s.invoiceCustomerDocType,
      invoiceCustomerDocNumber: s.invoiceCustomerDocNumber,
      invoiceCustomerDocDv: null,
      customerEmail: null,
      canRetry:
        !!s.linesJson &&
        (s.invoiceStatus === 'error' || s.invoiceStatus === 'rejected'),
      _sortAt: s.issuedAt ?? s.createdAt,
    }));

    const merged = [...orderItems, ...bulkItems].sort((a, b) => {
      const ta = a._sortAt ? new Date(a._sortAt).getTime() : 0;
      const tb = b._sortAt ? new Date(b._sortAt).getTime() : 0;
      return tb - ta;
    });

    const total = merged.length;
    const pageItems = opts.exportMode
      ? merged
      : merged.slice((page - 1) * limit, page * limit);

    const items = pageItems.map(({ _sortAt, ...row }) => row);

    return {
      from: opts.from,
      to: opts.to,
      page,
      limit,
      total,
      summary,
      items,
    };
  }

  /** CSV admin: órdenes + FE de lote. */
  async exportElectronicInvoicesCsv(opts: {
    from: string;
    to: string;
    status?: string;
    search?: string;
  }): Promise<{ filename: string; csv: string }> {
    const data = await this.findElectronicInvoicesForAdmin({
      ...opts,
      page: 1,
      limit: 10_000,
      exportMode: true,
    });

    const headers = [
      'origen',
      'pedido_diario',
      'order_id',
      'lote_id',
      'cliente',
      'telefono',
      'email',
      'tipo_doc',
      'documento',
      'dv',
      'estado_fe',
      'numero_fe',
      'cufe',
      'url_publica',
      'emitida_at',
      'numero_nc',
      'cufe_nc',
      'nc_at',
      'error',
      'tipo_orden',
      'estado_orden',
      'creada_at',
    ];

    const escape = (v: unknown): string => {
      if (v == null || v === '') return '';
      const s = String(v);
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    const lines = [headers.join(',')];
    for (const row of data.items) {
      lines.push(
        [
          row.source === 'bulk' ? 'lote' : 'pedido',
          row.dailyOrderNumber ?? (row.batchIndex != null ? `Lote #${row.batchIndex}` : ''),
          row.orderId ?? '',
          row.batchId ?? '',
          row.customerName,
          row.phone,
          row.customerEmail,
          row.invoiceCustomerDocType,
          row.invoiceCustomerDocNumber,
          row.invoiceCustomerDocDv,
          row.electronicInvoiceStatus,
          row.electronicInvoiceNumber,
          row.electronicInvoiceCufe,
          row.electronicInvoicePublicUrl,
          row.electronicInvoiceIssuedAt,
          row.electronicCreditNoteNumber,
          row.electronicCreditNoteCufe,
          row.electronicCreditNoteIssuedAt,
          row.electronicInvoiceError,
          row.orderType,
          row.orderStatus,
          row.createdAt,
        ]
          .map(escape)
          .join(','),
      );
    }

    return {
      filename: `facturas-fe_${opts.from}_${opts.to}.csv`,
      csv: lines.join('\n'),
    };
  }

  /**
   * Trae las últimas N FE de lote (PPP-LOTE-*) desde Factus y las guarda en
   * ppp_factus_standalone_invoices si aún no existen.
   */
  async backfillStandaloneInvoicesFromFactus(opts?: {
    limit?: number;
    /** Si true, incluye cualquier FE reciente (no solo lote). */
    includeOrderInvoices?: boolean;
  }): Promise<{
    fetched: number;
    candidates: number;
    inserted: number;
    skipped: number;
    items: Array<{
      number: string;
      action: 'inserted' | 'skipped_exists' | 'skipped_not_lote' | 'skipped_order';
      id?: number;
      reason?: string;
    }>;
  }> {
    if (!this.auth.isConfigured()) {
      throw new BadRequestException('Factus no está configurado');
    }

    const limit = Math.min(50, Math.max(1, opts?.limit ?? 1));
    const includeOrderInvoices = opts?.includeOrderInvoices === true;
    const perPage = 20;
    const maxPages = 10;

    const lotePrefix = 'PPP-LOTE-';
    const toProcess: FactusBillListItem[] = [];
    let fetched = 0;

    for (let page = 1; page <= maxPages && toProcess.length < limit; page += 1) {
      const listRes = await this.api.listBills({ page, perPage });
      const rows = listRes.data?.data ?? [];
      if (!rows.length) break;
      fetched += rows.length;

      for (const row of rows) {
        const ref = row.reference_code || '';
        if (!ref || !row.number) continue;
        if (!includeOrderInvoices && !ref.startsWith(lotePrefix)) continue;
        toProcess.push(row);
        if (toProcess.length >= limit) break;
      }

      const lastPage = listRes.data?.last_page ?? page;
      if (page >= lastPage) break;
    }

    const result = {
      fetched,
      candidates: toProcess.length,
      inserted: 0,
      skipped: 0,
      items: [] as Array<{
        number: string;
        action: 'inserted' | 'skipped_exists' | 'skipped_not_lote' | 'skipped_order';
        id?: number;
        reason?: string;
      }>,
    };

    for (const summary of toProcess) {
      const number = summary.number?.trim();
      const ref = summary.reference_code?.trim() || '';
      if (!number) continue;

      if (!includeOrderInvoices && !ref.startsWith(lotePrefix)) {
        result.skipped += 1;
        result.items.push({
          number,
          action: 'skipped_not_lote',
          reason: ref || 'sin reference_code',
        });
        continue;
      }

      const existingStandalone = await this.standaloneInvoiceRepo.findOne({
        where: { invoiceNumber: number },
      });
      if (existingStandalone) {
        result.skipped += 1;
        result.items.push({
          number,
          action: 'skipped_exists',
          id: existingStandalone.id,
          reason: 'ya en ppp_factus_standalone_invoices',
        });
        continue;
      }

      const linkedOrder = await this.orderRepo.findOne({
        where: { electronicInvoiceNumber: number },
      });
      if (linkedOrder) {
        result.skipped += 1;
        result.items.push({
          number,
          action: 'skipped_order',
          reason: `orden PPP #${linkedOrder.id}`,
        });
        continue;
      }

      let detail: FactusBillDetail = summary;
      if (!detail.cufe || !detail.links?.public_url) {
        try {
          detail = await this.api.getBill(number);
        } catch (err) {
          this.logger.warn(
            `[FE backfill] getBill ${number} falló: ${err instanceof Error ? err.message : err}`,
          );
        }
      }

      const { batchId, batchIndex } = this.parseLoteReferenceCode(
        detail.reference_code || ref,
      );
      const customer = detail.customer;
      const customerName =
        customer?.names ||
        customer?.graphic_representation_name ||
        customer?.company ||
        'Consumidor final';
      const plannedSum = Math.round(
        Number.parseFloat(String(detail.total ?? summary.total ?? '0')) || 0,
      );

      const saved = await this.standaloneInvoiceRepo.save(
        this.standaloneInvoiceRepo.create({
          batchId,
          batchIndex,
          referenceCode: (detail.reference_code || ref).slice(0, 100),
          customerName: customerName.slice(0, 100),
          invoiceStatus: detail.is_validated === false ? 'rejected' : 'accepted',
          invoiceNumber: number,
          invoiceCufe: detail.cufe ?? null,
          publicUrl: detail.links?.public_url ?? null,
          qrUrl: detail.links?.qr ?? null,
          issuedAt:
            this.parseFactusDateTime(detail.validated_at) ||
            this.parseFactusDateTime(detail.created_at) ||
            new Date(),
          plannedSum,
          invoiceCustomerDocType:
            customer?.identification_document?.code ?? null,
          invoiceCustomerDocNumber: customer?.identification ?? null,
        }),
      );

      result.inserted += 1;
      result.items.push({ number, action: 'inserted', id: saved.id });
      this.logger.log(
        `[FE backfill] guardada ${number} → standalone id=${saved.id} batch=${batchId}#${batchIndex}`,
      );
    }

    return result;
  }

  /**
   * Consulta / refresca FE de lote en Factus.
   * Según docs Factus: si DIAN tarda, reenviar POST /validate con el MISMO
   * reference_code + mismos datos (no solo listar).
   */
  async syncStandaloneInvoiceFromFactus(bulkInvoiceId: number): Promise<{
    updated: boolean;
    status: string;
    number: string | null;
    message: string;
    error?: string | null;
  }> {
    if (!this.auth.isConfigured()) {
      throw new BadRequestException('Factus no está configurado');
    }

    const row = await this.standaloneInvoiceRepo.findOne({
      where: { id: bulkInvoiceId },
    });
    if (!row) {
      throw new NotFoundException(`FE de lote #${bulkInvoiceId} no encontrada`);
    }

    if (row.invoiceStatus === 'accepted') {
      return {
        updated: false,
        status: row.invoiceStatus,
        number: row.invoiceNumber,
        message: `Ya está aceptada${row.invoiceNumber ? ` (${row.invoiceNumber})` : ''}`,
      };
    }

    // 1) Refresh oficial Factus: re-POST validate con la misma referencia
    if (row.linesJson?.trim()) {
      try {
        const lines = JSON.parse(row.linesJson) as BulkInvoicePlan['lines'];
        if (Array.isArray(lines) && lines.length) {
          const issueDto: IssueElectronicInvoiceDto = {
            ...BULK_CONSUMIDOR_FINAL,
            sendEmail: false,
            observation: `Sync lote #${row.batchIndex}`.slice(0, 250),
          };
          const taxConfig = await this.invoiceSettings.getResolvedTaxConfig();
          const { payload } = this.mapper.buildValidatePayloadFromCatalogLines(
            lines,
            issueDto,
            taxConfig,
            {
              referenceCode: row.referenceCode,
              observation: issueDto.observation,
            },
          );
          this.logger.log(
            `[FE sync] re-validate ref=${row.referenceCode} id=${row.id}`,
          );
          const result = await this.api.validateBill(payload);
          const data = result.data;
          const outcome = this.resolveFactusValidationOutcome({
            isValidated: data?.is_validated,
            number: data?.number,
            message: result.message,
            errors: data?.errors,
          });
          row.invoiceStatus = outcome.status;
          row.invoiceNumber = data?.number ?? row.invoiceNumber;
          row.invoiceCufe = data?.cufe ?? row.invoiceCufe;
          row.publicUrl = data?.links?.public_url ?? row.publicUrl;
          row.qrUrl =
            (data?.links as { qr_url?: string; qr?: string } | undefined)?.qr_url ??
            (data?.links as { qr?: string } | undefined)?.qr ??
            row.qrUrl;
          row.invoiceError = outcome.error ?? outcome.info;
          if (outcome.status === 'accepted') {
            row.invoiceError = null;
            row.issuedAt = row.issuedAt || new Date();
            await this.upsertInvoiceCustomer(issueDto);
          } else if (outcome.status === 'pending' && row.invoiceNumber && !row.issuedAt) {
            row.issuedAt = new Date();
          }
          await this.standaloneInvoiceRepo.save(row);
          return {
            updated: true,
            status: outcome.status,
            number: row.invoiceNumber,
            message:
              outcome.status === 'accepted'
                ? `Validada: ${row.invoiceNumber}`
                : outcome.status === 'pending'
                  ? outcome.info ||
                    'Factus/DIAN aún procesando. Se reconsultará automáticamente.'
                  : outcome.error || 'Rechazada',
            error: row.invoiceError,
          };
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`[FE sync] re-validate falló id=${row.id}: ${msg}`);
        // 409 pendiente atascada: eliminar ref en Factus y dejar listo para reintento
        if (/pendiente|409|Conflict/i.test(msg)) {
          try {
            await this.api.deleteBillByReference(row.referenceCode);
            row.invoiceStatus = 'error';
            row.invoiceError = (
              'Se eliminó en Factus una factura pendiente/bloqueada. Usa Reintentar para emitir de nuevo. ' +
              `Ref: ${row.referenceCode}`
            ).slice(0, 1000);
            await this.standaloneInvoiceRepo.save(row);
            return {
              updated: true,
              status: 'error',
              number: row.invoiceNumber,
              message: row.invoiceError,
              error: row.invoiceError,
            };
          } catch (delErr) {
            this.logger.warn(
              `[FE sync] delete ref falló: ${delErr instanceof Error ? delErr.message : delErr}`,
            );
          }
        }
      }
    }

    // 2) Fallback: listar por reference_code
    const listRes = await this.api.listBills({
      referenceCode: row.referenceCode,
      perPage: 10,
      page: 1,
    });
    const matches = (listRes.data?.data ?? []).filter(
      (b) =>
        (b.reference_code || '').trim() === row.referenceCode.trim() ||
        (!!row.invoiceNumber && b.number === row.invoiceNumber),
    );

    if (!matches.length) {
      const msg =
        'Factus aún no tiene una factura con esta referencia. ' +
        'Si el error era “en proceso / pendiente”, espera unos minutos (auto-consulta activa). ' +
        `Ref: ${row.referenceCode}`;
      row.invoiceError = msg.slice(0, 1000);
      await this.standaloneInvoiceRepo.save(row);
      return {
        updated: false,
        status: row.invoiceStatus,
        number: row.invoiceNumber,
        message: msg,
        error: row.invoiceError,
      };
    }

    let detail: FactusBillDetail = matches[0];
    const number = detail.number?.trim();
    if (number && (!detail.cufe || !detail.links?.public_url)) {
      try {
        detail = await this.api.getBill(number);
      } catch (err) {
        this.logger.warn(
          `[FE sync] getBill ${number} falló: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    if (detail.is_validated === false) {
      const outcome = this.resolveFactusValidationOutcome({
        isValidated: false,
        number: detail.number,
        message: listRes.message,
      });
      row.invoiceStatus = outcome.status;
      row.invoiceNumber = detail.number ?? row.invoiceNumber;
      row.invoiceCufe = detail.cufe ?? row.invoiceCufe;
      row.publicUrl = detail.links?.public_url ?? row.publicUrl;
      row.qrUrl = detail.links?.qr ?? row.qrUrl;
      row.invoiceError = outcome.error ?? outcome.info;
      if (outcome.status === 'pending' && !row.issuedAt && row.invoiceNumber) {
        row.issuedAt = new Date();
      }
      await this.standaloneInvoiceRepo.save(row);
      return {
        updated: true,
        status: outcome.status,
        number: row.invoiceNumber,
        message:
          outcome.status === 'pending'
            ? outcome.info ||
              `Factura ${row.invoiceNumber || ''} en validación DIAN. Auto-consulta activa.`
            : outcome.error || 'Rechazada por DIAN',
        error: row.invoiceError,
      };
    }

    // is_validated true o con CUFE → aceptar
    if (detail.is_validated === true || (detail.number && detail.cufe)) {
      row.invoiceStatus = 'accepted';
      row.invoiceNumber = detail.number ?? row.invoiceNumber;
      row.invoiceCufe = detail.cufe ?? row.invoiceCufe;
      row.publicUrl = detail.links?.public_url ?? row.publicUrl;
      row.qrUrl = detail.links?.qr ?? row.qrUrl;
      row.issuedAt =
        this.parseFactusDateTime(detail.validated_at) ||
        this.parseFactusDateTime(detail.created_at) ||
        row.issuedAt ||
        new Date();
      row.invoiceError = null;
      await this.standaloneInvoiceRepo.save(row);

      return {
        updated: true,
        status: 'accepted',
        number: row.invoiceNumber,
        message: `Actualizada: ${row.invoiceNumber || 'aceptada en Factus'}`,
        error: null,
      };
    }

    const outcome = this.resolveFactusValidationOutcome({
      isValidated: detail.is_validated,
      number: detail.number,
      message: listRes.message,
    });
    row.invoiceStatus = outcome.status;
    row.invoiceNumber = detail.number ?? row.invoiceNumber;
    row.invoiceError = outcome.error ?? outcome.info;
    await this.standaloneInvoiceRepo.save(row);
    return {
      updated: true,
      status: outcome.status,
      number: row.invoiceNumber,
      message: outcome.info || outcome.error || 'Estado actualizado',
      error: row.invoiceError,
    };
  }

  /**
   * Reemite una FE de lote fallida usando las líneas guardadas.
   * No aplica si ya está accepted o solo pendiente de DIAN (usar sync).
   */
  async retryStandaloneInvoice(bulkInvoiceId: number): Promise<{
    ok: boolean;
    status: string;
    number: string | null;
    message: string;
    error?: string | null;
  }> {
    if (!this.auth.isConfigured()) {
      throw new BadRequestException('Factus no está configurado');
    }

    const row = await this.standaloneInvoiceRepo.findOne({
      where: { id: bulkInvoiceId },
    });
    if (!row) {
      throw new NotFoundException(`FE de lote #${bulkInvoiceId} no encontrada`);
    }

    if (row.invoiceStatus === 'accepted') {
      return {
        ok: true,
        status: 'accepted',
        number: row.invoiceNumber,
        message: `Ya está aceptada (${row.invoiceNumber || 'sin número'})`,
      };
    }

    if (row.invoiceStatus === 'pending' && row.invoiceNumber) {
      throw new BadRequestException(
        `La factura ${row.invoiceNumber} ya fue enviada y está en validación DIAN. Usa “Consultar Factus”, no reintentar.`,
      );
    }

    if (!row.linesJson?.trim()) {
      throw new BadRequestException(
        'Esta factura de lote no tiene productos guardados para reintentar (se emitió antes del fix). ' +
          'Emite un lote nuevo desde Facturas → Lote.',
      );
    }

    let lines: BulkInvoicePlan['lines'];
    try {
      lines = JSON.parse(row.linesJson);
    } catch {
      throw new BadRequestException('No se pudieron leer las líneas guardadas para reintentar');
    }
    if (!Array.isArray(lines) || !lines.length) {
      throw new BadRequestException('No hay líneas válidas para reintentar');
    }

    // Si Factus ya tiene la ref, sincronizar en vez de duplicar
    try {
      const sync = await this.syncStandaloneInvoiceFromFactus(bulkInvoiceId);
      if (sync.status === 'accepted' || sync.status === 'pending') {
        return {
          ok: sync.status === 'accepted',
          status: sync.status,
          number: sync.number,
          message:
            sync.status === 'accepted'
              ? sync.message
              : 'Ya existe en Factus en validación. No se reemitió para evitar duplicado.',
          error: sync.error,
        };
      }
    } catch (err) {
      this.logger.warn(
        `[FE retry] sync previo falló id=${bulkInvoiceId}: ${err instanceof Error ? err.message : err}`,
      );
    }

    const issueDto: IssueElectronicInvoiceDto = {
      ...BULK_CONSUMIDOR_FINAL,
      sendEmail: false,
      observation: `Reintento lote #${row.batchIndex}`.slice(0, 250),
    };
    const taxConfig = await this.invoiceSettings.getResolvedTaxConfig();
    const referenceCode =
      `PPP-LOTE-${row.batchId}-R${Date.now().toString(36)}-${row.batchIndex}`.slice(0, 100);

    try {
      const { payload, invoiceTotal } = this.mapper.buildValidatePayloadFromCatalogLines(
        lines,
        issueDto,
        taxConfig,
        { referenceCode, observation: issueDto.observation },
      );
      this.logger.log(
        `[FE retry] id=${row.id} ref=${referenceCode} items=${payload.items.length} total≈${invoiceTotal}`,
      );

      const result = await this.api.validateBill(payload);
      const data = result.data;
      const outcome = this.resolveFactusValidationOutcome({
        isValidated: data?.is_validated,
        number: data?.number,
        message: result.message,
        errors: data?.errors,
      });

      row.referenceCode = referenceCode;
      row.invoiceStatus = outcome.status;
      row.invoiceNumber = data?.number ?? null;
      row.invoiceCufe = data?.cufe ?? null;
      row.publicUrl = data?.links?.public_url ?? null;
      row.qrUrl = (data?.links as { qr_url?: string } | undefined)?.qr_url ?? null;
      row.invoiceError = outcome.error ?? outcome.info;
      if (outcome.status === 'accepted' || (outcome.status === 'pending' && data?.number)) {
        row.issuedAt = new Date();
      }
      if (outcome.status === 'accepted') {
        row.invoiceError = null;
        await this.upsertInvoiceCustomer(issueDto);
      }
      await this.standaloneInvoiceRepo.save(row);

      return {
        ok: outcome.status === 'accepted',
        status: outcome.status,
        number: row.invoiceNumber,
        message:
          outcome.status === 'accepted'
            ? `Reintento OK: ${row.invoiceNumber}`
            : outcome.status === 'pending'
              ? outcome.info || `Enviada (${row.invoiceNumber}). En validación DIAN.`
              : outcome.error || 'Rechazada al reintentar',
        error: row.invoiceError,
      };
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err && 'message' in err
            ? String((err as { message: unknown }).message)
            : 'Error al reintentar';
      row.invoiceStatus = 'error';
      row.invoiceError = message.slice(0, 1000);
      row.referenceCode = referenceCode;
      await this.standaloneInvoiceRepo.save(row);
      return {
        ok: false,
        status: 'error',
        number: row.invoiceNumber,
        message,
        error: row.invoiceError,
      };
    }
  }

  /**
   * Sincroniza en lote FE pendientes/error/rechazo (admin auto-poll).
   */
  async syncPendingElectronicInvoices(opts?: {
    limit?: number;
  }): Promise<{
    checked: number;
    accepted: number;
    pending: number;
    failed: number;
    results: Array<{
      source: 'bulk' | 'order';
      id: number;
      status: string;
      message: string;
    }>;
  }> {
    const limit = Math.min(25, Math.max(1, opts?.limit ?? 15));
    const standalones = await this.standaloneInvoiceRepo.find({
      where: { invoiceStatus: In(['pending', 'error', 'rejected']) },
      order: { createdAt: 'DESC' },
      take: limit,
    });

    const results: Array<{
      source: 'bulk' | 'order';
      id: number;
      status: string;
      message: string;
    }> = [];
    let accepted = 0;
    let pending = 0;
    let failed = 0;

    for (const s of standalones) {
      try {
        const r = await this.syncStandaloneInvoiceFromFactus(s.id);
        results.push({
          source: 'bulk',
          id: s.id,
          status: r.status,
          message: r.message,
        });
        if (r.status === 'accepted') accepted += 1;
        else if (r.status === 'pending') pending += 1;
        else failed += 1;
      } catch (err) {
        failed += 1;
        results.push({
          source: 'bulk',
          id: s.id,
          status: 'error',
          message: err instanceof Error ? err.message : 'Error sync',
        });
      }
    }

    const remaining = limit - standalones.length;
    if (remaining > 0) {
      const orders = await this.orderRepo.find({
        where: {
          electronicInvoiceStatus: In(['pending', 'error', 'rejected']),
        },
        order: { createdAt: 'DESC' },
        take: remaining,
      });
      for (const o of orders) {
        try {
          const r = await this.syncOrderInvoiceFromFactus(o.id);
          results.push({
            source: 'order',
            id: o.id,
            status: r.status,
            message: r.message,
          });
          if (r.status === 'accepted') accepted += 1;
          else if (r.status === 'pending') pending += 1;
          else failed += 1;
        } catch (err) {
          failed += 1;
          results.push({
            source: 'order',
            id: o.id,
            status: 'error',
            message: err instanceof Error ? err.message : 'Error sync',
          });
        }
      }
    }

    return {
      checked: results.length,
      accepted,
      pending,
      failed,
      results,
    };
  }

  /**
   * Consulta Factus por PPP-ORD-{id} cuando la FE de un pedido quedó en error/rechazo.
   */
  async syncOrderInvoiceFromFactus(orderId: number): Promise<{
    updated: boolean;
    status: string;
    number: string | null;
    message: string;
    error?: string | null;
  }> {
    if (!this.auth.isConfigured()) {
      throw new BadRequestException('Factus no está configurado');
    }

    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Orden no encontrada');

    if (order.electronicInvoiceStatus === 'accepted') {
      return {
        updated: false,
        status: order.electronicInvoiceStatus,
        number: order.electronicInvoiceNumber,
        message: `Ya está aceptada${order.electronicInvoiceNumber ? ` (${order.electronicInvoiceNumber})` : ''}`,
      };
    }

    const referenceCode =
      order.electronicInvoiceReference?.trim() || `PPP-ORD-${order.id}`;

    const listRes = await this.api.listBills({
      referenceCode,
      perPage: 10,
      page: 1,
    });
    const matches = (listRes.data?.data ?? []).filter(
      (b) => (b.reference_code || '').trim() === referenceCode,
    );

    if (!matches.length) {
      const msg =
        'Factus aún no tiene factura para este pedido. ' +
        'Si dice “en proceso / pendiente”, espera y consulta de nuevo. ' +
        `Ref: ${referenceCode}`;
      order.electronicInvoiceError = msg.slice(0, 1000);
      await this.orderRepo.save(order);
      return {
        updated: false,
        status: order.electronicInvoiceStatus || 'error',
        number: order.electronicInvoiceNumber,
        message: msg,
        error: order.electronicInvoiceError,
      };
    }

    let detail: FactusBillDetail = matches[0];
    const number = detail.number?.trim();
    if (number && (!detail.cufe || !detail.links?.public_url)) {
      try {
        detail = await this.api.getBill(number);
      } catch (err) {
        this.logger.warn(
          `[FE sync order] getBill ${number} falló: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    if (detail.is_validated === false) {
      const outcome = this.resolveFactusValidationOutcome({
        isValidated: false,
        number: detail.number,
        message: listRes.message,
      });
      order.electronicInvoiceStatus = outcome.status;
      order.electronicInvoiceNumber =
        detail.number ?? order.electronicInvoiceNumber;
      order.electronicInvoiceCufe = detail.cufe ?? order.electronicInvoiceCufe;
      order.electronicInvoicePublicUrl =
        detail.links?.public_url ?? order.electronicInvoicePublicUrl;
      order.electronicInvoiceQrUrl =
        detail.links?.qr ?? order.electronicInvoiceQrUrl;
      order.electronicInvoiceError = outcome.error ?? outcome.info;
      await this.orderRepo.save(order);
      return {
        updated: true,
        status: outcome.status,
        number: order.electronicInvoiceNumber,
        message:
          outcome.status === 'pending'
            ? outcome.info || 'En validación DIAN'
            : outcome.error || 'Rechazada por DIAN',
        error: order.electronicInvoiceError,
      };
    }

    order.electronicInvoiceStatus = 'accepted';
    order.electronicInvoiceNumber = detail.number ?? order.electronicInvoiceNumber;
    order.electronicInvoiceCufe = detail.cufe ?? order.electronicInvoiceCufe;
    order.electronicInvoicePublicUrl =
      detail.links?.public_url ?? order.electronicInvoicePublicUrl;
    order.electronicInvoiceQrUrl =
      detail.links?.qr ?? order.electronicInvoiceQrUrl;
    order.electronicInvoiceIssuedAt =
      this.parseFactusDateTime(detail.validated_at) ||
      this.parseFactusDateTime(detail.created_at) ||
      order.electronicInvoiceIssuedAt ||
      new Date();
    order.electronicInvoiceError = null;
    await this.orderRepo.save(order);

    return {
      updated: true,
      status: 'accepted',
      number: order.electronicInvoiceNumber,
      message: `Actualizada: ${order.electronicInvoiceNumber || 'aceptada en Factus'}`,
      error: null,
    };
  }

  /**
   * Interpreta respuesta Factus: "Solicitud exitosa" + is_validated=false
   * suele ser pendiente DIAN, no rechazo.
   */
  private resolveFactusValidationOutcome(opts: {
    isValidated?: boolean;
    number?: string | null;
    message?: string | null;
    errors?: unknown;
  }): FactusValidationOutcome {
    if (opts.isValidated === true) {
      return { status: 'accepted', error: null, info: null };
    }

    const msg = (opts.message || '').trim();
    const hasErrors =
      !!opts.errors &&
      (typeof opts.errors === 'object'
        ? Object.keys(opts.errors as object).length > 0
        : true);
    const looksSoftPending =
      /solicitud exitosa/i.test(msg) ||
      /en proceso/i.test(msg) ||
      /pendiente por valid/i.test(msg) ||
      (/exitos/i.test(msg) && !/no exitos|fall/i.test(msg));
    const looksHardReject =
      /rechaz/i.test(msg) ||
      /invalid/i.test(msg) ||
      /no se pudo/i.test(msg) ||
      /error/i.test(msg);

    if (opts.isValidated === false) {
      if (opts.number && (looksSoftPending || !hasErrors) && !looksHardReject) {
        return {
          status: 'pending',
          error: null,
          info: (
            opts.number
              ? `Factura ${opts.number} enviada. En validación DIAN — usa “Consultar Factus” en unos minutos.`
              : 'Enviada a DIAN. En validación — consulta Factus en unos minutos.'
          ).slice(0, 1000),
        };
      }
      return {
        status: 'rejected',
        error: (
          msg ||
          (hasErrors ? JSON.stringify(opts.errors) : 'Factura no validada por DIAN')
        ).slice(0, 1000),
        info: null,
      };
    }

    if (opts.number && looksSoftPending) {
      return {
        status: 'pending',
        error: null,
        info: `Factura ${opts.number} en validación DIAN.`.slice(0, 1000),
      };
    }

    return {
      status: 'pending',
      error: null,
      info: (msg || 'Pendiente de validación DIAN').slice(0, 1000),
    };
  }

  private parseLoteReferenceCode(referenceCode: string): {
    batchId: string;
    batchIndex: number;
  } {
    const ref = referenceCode.trim();
    const m = ref.match(/^PPP-LOTE-(.+)-(\d+)$/);
    if (m) {
      return { batchId: m[1].slice(0, 64), batchIndex: parseInt(m[2], 10) || 1 };
    }
    return {
      batchId: `backfill-${Date.now()}`.slice(0, 64),
      batchIndex: 1,
    };
  }

  /** Factus: "30-08-2026 10:08:12 PM" */
  private parseFactusDateTime(value: string | undefined | null): Date | null {
    if (!value) return null;
    const m = value.match(
      /^(\d{2})-(\d{2})-(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)$/i,
    );
    if (!m) return null;
    let hour = parseInt(m[4], 10);
    const ampm = m[7].toUpperCase();
    if (ampm === 'PM' && hour < 12) hour += 12;
    if (ampm === 'AM' && hour === 12) hour = 0;
    return new Date(
      parseInt(m[3], 10),
      parseInt(m[2], 10) - 1,
      parseInt(m[1], 10),
      hour,
      parseInt(m[5], 10),
      parseInt(m[6], 10),
    );
  }

  private async loadBulkCatalogProducts() {
    const all = await this.productsService.findAll();
    return (all || [])
      .filter((p) => p?.isActive !== false && Number(p.price) > 0)
      .map((p) => {
        const defaultAttributes: Array<{
          attributeName: string;
          attributeValue: string;
        }> = [];
        if (p.hasAttributes && Array.isArray(p.attributes)) {
          for (const attr of p.attributes) {
            const name = String(attr?.attributeName || '').trim();
            const options = Array.isArray(attr?.options)
              ? attr.options
              : typeof attr?.options === 'string'
                ? (() => {
                    try {
                      return JSON.parse(attr.options);
                    } catch {
                      return [];
                    }
                  })()
                : [];
            const first = String(options?.[0] || '').trim();
            if (name && first) {
              defaultAttributes.push({
                attributeName: name,
                attributeValue: first,
              });
            }
          }
        }
        return {
          id: p.id,
          name: p.name,
          code: Number(p.code),
          price: Math.round(Number(p.price)),
          ...(defaultAttributes.length ? { defaultAttributes } : {}),
        };
      });
  }
}
