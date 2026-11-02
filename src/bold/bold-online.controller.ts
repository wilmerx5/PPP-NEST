import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { Auth } from '../auth/decorators/auth.decorator';
import { ValidRoles } from '../auth/interfaces/valid.roles.interface';
import { User } from '../auth/entities/user.entity';
import { BoldOnlineKeyDto, CreateBoldQrDto } from './bold-online.dto';
import { BoldOnlineService } from './bold-online.service';
@Controller('bold/online')
export class BoldOnlineController {
  constructor(private readonly service: BoldOnlineService) {}
  @Get() @Auth(ValidRoles.admin) overview() {
    return this.service.overview();
  }
  @Put('key') @Auth(ValidRoles.admin) saveKey(@Body() dto: BoldOnlineKeyDto) {
    return this.service.saveKey(dto.identityKey);
  }
  @Post('check') @Auth(ValidRoles.admin) check() {
    return this.service.checkAccess();
  }
  @Post('qr') @Auth(ValidRoles.admin) create(
    @Body() dto: CreateBoldQrDto,
    @Req() req: Request,
  ) {
    return this.service.create(dto, req.user as User);
  }
  @Post('qr/:id/status') @Auth(ValidRoles.admin) refresh(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.refresh(id);
  }
}
