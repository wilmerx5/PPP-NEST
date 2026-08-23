import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class WhatsappPaymentMethodDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  id?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  label?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  optionText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1500)
  confirmReply?: string;

  @IsOptional()
  @IsIn(['immediate', 'mercadopago'])
  flow?: 'immediate' | 'mercadopago';
}

export class MenuConceptGroupDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  label?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  triggers?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  productKeywords?: string[];

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

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
  appSecret?: string;

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
  @Type(() => Number)
  @IsInt()
  @Min(0)
  defaultDeliveryFee?: number;

  @IsOptional()
  @IsBoolean()
  allowMercadoPago?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WhatsappPaymentMethodDto)
  paymentMethods?: WhatsappPaymentMethodDto[];

  @IsOptional()
  @IsArray()
  menuConceptGroups?: MenuConceptGroupDto[];

  @IsOptional()
  @IsString()
  welcomeMessage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  restaurantName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  restaurantAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  restaurantCity?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  restaurantNeighborhood?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  mapsUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  publicPhone?: string;

  @IsOptional()
  @IsString()
  landmarks?: string;

  @IsOptional()
  @IsString()
  pickupNotes?: string;

  @IsOptional()
  @IsString()
  deliveryNotes?: string;

  @IsOptional()
  @IsString()
  aiExtraContext?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  menuUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  websiteUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  instagramUrl?: string;

  @IsOptional()
  @IsBoolean()
  ignoreBusinessHours?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  prepTimeNote?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  deliveryTimeNote?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minOrderAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxOrderAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxUnitsPerItem?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxTotalUnits?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxCartLines?: number;

  @IsOptional()
  @IsBoolean()
  handoffWhenMaxExceeded?: boolean;

  @IsOptional()
  @IsString()
  largeOrderHandoffMessage?: string;

  @IsOptional()
  @IsString()
  allergensNote?: string;

  @IsOptional()
  @IsString()
  promotionsNote?: string;

  @IsOptional()
  @IsString()
  serviceAreaNote?: string;

  @IsOptional()
  @IsString()
  cashChangeNote?: string;

  @IsOptional()
  @IsString()
  transferInfoNote?: string;

  @IsOptional()
  @IsString()
  specialRequestsNote?: string;

  @IsOptional()
  @IsBoolean()
  askOrderNotes?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(120)
  rateLimitPerMinute?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(24 * 60)
  humanAgentIdleMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(24 * 60)
  humanClientIdleMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(24 * 60)
  orderDraftIdleMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(24 * 60)
  pendingChoiceIdleMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(24 * 60)
  mpPaymentIdleMinutes?: number;

  @IsOptional()
  @IsBoolean()
  sessionIdleNotify?: boolean;

  @IsOptional()
  @IsString()
  paymentInstructions?: string;

  @IsOptional()
  @IsString()
  hoursNote?: string;

  @IsOptional()
  @IsString()
  cancelPolicyNote?: string;

  @IsOptional()
  @IsString()
  humanHandoffMessage?: string;

  @IsOptional()
  @IsString()
  closedMessage?: string;

  @IsOptional()
  @IsString()
  menuLinkMessage?: string;

  @IsOptional()
  @IsString()
  orderSuccessMessage?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1.5)
  aiTemperature?: number;
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
