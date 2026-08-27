import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Auth } from '../auth/decorators/auth.decorator';
import { ValidRoles } from '../auth/interfaces/valid.roles.interface';
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
}
