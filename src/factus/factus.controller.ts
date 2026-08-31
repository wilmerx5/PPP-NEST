import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Auth } from '../auth/decorators/auth.decorator';
import { ValidRoles } from '../auth/interfaces/valid.roles.interface';
import {
  CancelElectronicInvoiceDto,
  ResendElectronicInvoiceEmailDto,
} from './dto/factus-actions.dto';
import { IssueElectronicInvoiceDto } from './dto/issue-electronic-invoice.dto';
import {
  BulkElectronicInvoiceIssueDto,
  BulkElectronicInvoicePreviewDto,
} from './dto/bulk-electronic-invoice.dto';
import { UpdateFactusInvoiceSettingsDto } from './dto/factus-invoice-settings.dto';
import { UpdateInvoiceCustomerDto } from './dto/update-invoice-customer.dto';
import { FactusService } from './factus.service';
import { FactusInvoiceSettingsService } from './factus-invoice-settings.service';

const OPS = [
  ValidRoles.admin,
  ValidRoles.ordersUser,
  ValidRoles.tableUser,
] as const;

@ApiTags('Facturación electrónica (Factus)')
@Controller()
export class FactusController {
  constructor(
    private readonly factusService: FactusService,
    private readonly invoiceSettings: FactusInvoiceSettingsService,
  ) {}

  @Get('factus/status')
  @Auth(ValidRoles.admin, ValidRoles.ordersUser)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Estado de configuración Factus (sin secretos)' })
  getStatus() {
    return this.factusService.getStatus();
  }

  @Get('admin/factus/invoice-settings')
  @Auth(ValidRoles.admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Config impuestos FE (admin) — editable sin tocar .env' })
  getInvoiceSettings() {
    return this.invoiceSettings.getAdminSettings();
  }

  @Patch('admin/factus/invoice-settings')
  @Auth(ValidRoles.admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Guardar impuestos FE por ítem (admin)' })
  updateInvoiceSettings(@Body() dto: UpdateFactusInvoiceSettingsDto) {
    return this.invoiceSettings.updateAdminSettings(dto);
  }

  @Get('factus/customers/search')
  @Auth(...OPS)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Buscar clientes fiscales guardados por nombre (autocomplete FE)' })
  @ApiQuery({ name: 'q', required: true })
  @ApiQuery({ name: 'limit', required: false })
  searchCustomers(@Query('q') q: string, @Query('limit') limit?: string) {
    const parsedLimit = limit ? Number(limit) : 10;
    return this.factusService.searchCustomers(q, Number.isFinite(parsedLimit) ? parsedLimit : 10);
  }

  @Get('admin/factus/customers')
  @Auth(ValidRoles.admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar clientes fiscales guardados al emitir FE (admin)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'search', required: false })
  listCustomersAdmin(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    const p = page ? Number(page) : 1;
    const l = limit ? Number(limit) : 50;
    return this.factusService.listCustomersAdmin(
      Number.isFinite(p) ? p : 1,
      Number.isFinite(l) ? l : 50,
      search,
    );
  }

  @Patch('admin/factus/customers/:id')
  @Auth(ValidRoles.admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Editar cliente fiscal guardado (admin)' })
  @ApiParam({ name: 'id', type: Number })
  updateCustomerAdmin(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateInvoiceCustomerDto,
  ) {
    return this.factusService.updateCustomerAdmin(id, dto);
  }

  @Post('admin/factus/bulk-invoices/preview')
  @Auth(ValidRoles.admin)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Preview lote FE desde catálogo (montos desiguales ≈ total)',
    description:
      'Reparte productos del menú en N facturas con totales distintos que suman el objetivo. No usa órdenes del día.',
  })
  previewBulkInvoices(@Body() dto: BulkElectronicInvoicePreviewDto) {
    return this.factusService.previewBulkElectronicInvoices(dto);
  }

  @Post('admin/factus/bulk-invoices/issue')
  @Auth(ValidRoles.admin)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Emitir lote FE: crea órdenes counter + Factus (consumidor final)',
  })
  issueBulkInvoices(@Body() dto: BulkElectronicInvoiceIssueDto) {
    return this.factusService.issueBulkElectronicInvoices(dto);
  }

  @Post('admin/factus/backfill-standalone-invoices')
  @Auth(ValidRoles.admin)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Importar FE de lote desde Factus → BD standalone (admin)',
    description:
      'Trae las últimas N facturas PPP-LOTE-* de Factus y las guarda en ppp_factus_standalone_invoices.',
  })
  @ApiQuery({ name: 'limit', required: false, example: 1 })
  @ApiQuery({
    name: 'includeOrderInvoices',
    required: false,
    description: 'Si true, incluye también FE de pedidos (PPP-ORD-*)',
  })
  backfillStandaloneInvoices(
    @Query('limit') limit?: string,
    @Query('includeOrderInvoices') includeOrderInvoices?: string,
  ) {
    const parsed = limit ? parseInt(limit, 10) : 1;
    return this.factusService.backfillStandaloneInvoicesFromFactus({
      limit: Number.isFinite(parsed) ? parsed : 1,
      includeOrderInvoices:
        includeOrderInvoices === 'true' || includeOrderInvoices === '1',
    });
  }

  @Get('factus/customers/lookup')
  @Auth(...OPS)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Buscar cliente fiscal guardado (autocomplete FE)' })
  @ApiQuery({ name: 'identificationDocumentCode', required: true })
  @ApiQuery({ name: 'identification', required: true })
  lookupCustomer(
    @Query('identificationDocumentCode') identificationDocumentCode: string,
    @Query('identification') identification: string,
  ) {
    return this.factusService.lookupCustomer(
      identificationDocumentCode,
      identification,
    );
  }

  @Post('orders/:id/electronic-invoice')
  @Auth(...OPS)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Emitir factura electrónica manual (Factus → DIAN)',
    description:
      'No se factura automáticamente. Solo cuando el operador lo pide desde tomar pedidos. PPP es la fuente de verdad; Factus solo transmite.',
  })
  @ApiParam({ name: 'id', description: 'ID de la orden PPP' })
  @ApiResponse({ status: 201, description: 'Factura creada/validada' })
  @ApiResponse({ status: 400, description: 'Datos incompletos o Factus rechazó' })
  @ApiResponse({ status: 409, description: 'Orden ya facturada' })
  issueInvoice(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: IssueElectronicInvoiceDto,
  ) {
    return this.factusService.issueForOrder(id, dto);
  }

  @Get('orders/:id/electronic-invoice/pdf')
  @Auth(...OPS)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Descargar / imprimir PDF de la factura electrónica' })
  @ApiParam({ name: 'id', description: 'ID de la orden PPP' })
  downloadPdf(@Param('id', ParseIntPipe) id: number) {
    return this.factusService.getInvoicePdf(id);
  }

  @Post('orders/:id/electronic-invoice/resend-email')
  @Auth(...OPS)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reenviar factura electrónica por correo' })
  resendEmail(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResendElectronicInvoiceEmailDto,
  ) {
    return this.factusService.resendInvoiceEmail(id, dto);
  }

  @Post('orders/:id/electronic-invoice/cancel')
  @Auth(...OPS)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Anular factura electrónica (nota crédito Factus → DIAN)',
  })
  cancelInvoice(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelElectronicInvoiceDto,
  ) {
    return this.factusService.cancelInvoice(id, dto);
  }
}
