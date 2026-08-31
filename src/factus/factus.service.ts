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
import { Repository } from 'typeorm';
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
import type { FactusValidateCreditNoteRequest } from './types/factus.types';
import {
  planBulkInvoicesFromCatalog,
  type BulkInvoicePlan,
} from './factus-bulk-select.util';

/** Adquiriente genérico DIAN para emisión en lote. */
const BULK_CONSUMIDOR_FINAL: IssueElectronicInvoiceDto = {
  identificationDocumentCode: '13',
  identification: '222222222222',
  legalOrganizationCode: '2',
  names: 'Consumidor final',
  sendEmail: false,
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
        if (data?.is_validated) {
          await this.upsertInvoiceCustomer(issueDto);
          results.push({
            index: inv.index,
            ok: true,
            sum: inv.sum,
            number: data?.number ?? null,
            cufe: data?.cufe ?? null,
            publicUrl: data?.links?.public_url ?? null,
          });
        } else {
          results.push({
            index: inv.index,
            ok: false,
            sum: inv.sum,
            number: data?.number ?? null,
            error:
              result.message ||
              JSON.stringify(data?.errors || 'Factura no validada por DIAN').slice(0, 400),
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
