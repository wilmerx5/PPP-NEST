import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { Auth } from '../auth/decorators/auth.decorator';
import { ValidRoles } from '../auth/interfaces/valid.roles.interface';
import { User } from '../auth/entities/user.entity';
import { BoldService } from './bold.service';
import { ClaimBoldDto } from './bold.dto';
@Controller('bold')
export class BoldController {
  constructor(private readonly service: BoldService) {}
  @Post('webhook')
  @HttpCode(200)
  receive(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-bold-signature') signature?: string,
  ) {
    return this.service.receive(req.rawBody ?? Buffer.alloc(0), signature);
  }
  @Get('receipts')
  @Auth(ValidRoles.admin, ValidRoles.paymentsUser)
  list() {
    return this.service.list();
  }
  @Post('receipts/:id/claim')
  @Auth(ValidRoles.admin, ValidRoles.paymentsUser)
  claim(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ClaimBoldDto,
    @Req() req: Request,
  ) {
    return this.service.claim(id, dto, req.user as User);
  }
  @Post('receipts/:id/return')
  @Auth(ValidRoles.admin)
  returnAdvance(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.service.returnAdvance(id, req.user as User);
  }
}
