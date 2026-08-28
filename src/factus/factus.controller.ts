import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
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
import { FactusService } from './factus.service';

const OPS = [
  ValidRoles.admin,
  ValidRoles.ordersUser,
  ValidRoles.tableUser,
] as const;

@ApiTags('Facturación electrónica (Factus)')
@Controller()
export class FactusController {
  constructor(private readonly factusService: FactusService) {}

  @Get('factus/status')
  @Auth(ValidRoles.admin, ValidRoles.ordersUser)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Estado de configuración Factus (sin secretos)' })
  getStatus() {
    return this.factusService.getStatus();
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
