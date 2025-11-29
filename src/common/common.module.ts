import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CommonController } from './common.controller';
import { CommonService } from './common.service';
import { MailService } from './mail/mail.service';

@Module({
  controllers: [CommonController],
  providers: [CommonService, MailService],
  imports:[ConfigModule],
  exports:[MailService]
})
export class CommonModule {}
