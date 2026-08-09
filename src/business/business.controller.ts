import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { BusinessService } from './business.service';

@ApiTags('Business')
@Controller('business')
export class BusinessController {
  constructor(private readonly businessService: BusinessService) {}

  @Get('status')
  @ApiOperation({
    summary: 'Estado de apertura del restaurante (público)',
    description:
      'Usa la zona horaria configurada en admin. Incluye festivos, días cerrados y horario.',
  })
  getStatus() {
    return this.businessService.getStatus();
  }
}
