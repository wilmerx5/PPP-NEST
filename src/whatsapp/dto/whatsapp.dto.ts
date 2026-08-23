import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateWhatsappSettingsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  displayPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  phoneNumberId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  wabaId?: string;

  @IsOptional()
  @IsString()
  accessToken?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  verifyToken?: string;

  @IsOptional()
  @IsString()
  openaiApiKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  openaiModel?: string;

  @IsOptional()
  @IsString()
  systemPrompt?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  defaultDeliveryFee?: number;

  @IsOptional()
  @IsBoolean()
  allowMercadoPago?: boolean;

  @IsOptional()
  @IsString()
  welcomeMessage?: string;
}

export class SendWhatsappMessageDto {
  @IsString()
  @MaxLength(4096)
  body: string;
}

export class TakeoverWhatsappConversationDto {
  @IsOptional()
  @IsBoolean()
  takeover?: boolean;
}
