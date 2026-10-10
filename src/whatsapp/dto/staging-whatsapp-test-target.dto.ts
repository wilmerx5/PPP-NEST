import { IsString, Matches } from 'class-validator';

export class StagingWhatsappTestTargetDto {
  @IsString()
  @Matches(/^\d{5,30}$/)
  phoneNumberId: string;

  @IsString()
  @Matches(/^\d{8,15}$/)
  recipient: string;
}
