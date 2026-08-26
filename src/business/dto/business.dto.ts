import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  WEB_DELIVERY_DEFAULT_FEE,
  WEB_DELIVERY_FEE_TIERS,
  WEB_DELIVERY_MAX_KM,
} from '../../delivery/web-delivery-fee';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export class WebDeliveryFeeTierDto {
  @ApiProperty({ example: 4 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  maxKm: number;

  @ApiProperty({ example: 4000 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  fee: number;
}

export class DayHoursDto {
  @ApiProperty({ example: 1, description: '0=Domingo … 6=Sábado' })
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @ApiProperty({ example: false })
  @IsBoolean()
  closed: boolean;

  @ApiProperty({ example: '11:00', required: false })
  @IsOptional()
  @Matches(HHMM, { message: 'openTime debe ser HH:mm' })
  openTime?: string;

  @ApiProperty({ example: '22:00', required: false })
  @IsOptional()
  @Matches(HHMM, { message: 'closeTime debe ser HH:mm' })
  closeTime?: string;
}

export class UpdateRestaurantSettingsDto {
  @ApiProperty({ example: 'America/Bogota', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @ApiProperty({ example: [0], description: '0=Domingo … 6=Sábado', required: false })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  weeklyClosedDays?: number[];

  @ApiProperty({ example: '11:00', required: false })
  @IsOptional()
  @Matches(HHMM, { message: 'openTime debe ser HH:mm' })
  openTime?: string;

  @ApiProperty({ example: '22:00', required: false })
  @IsOptional()
  @Matches(HHMM, { message: 'closeTime debe ser HH:mm' })
  closeTime?: string;

  @ApiProperty({ type: [DayHoursDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DayHoursDto)
  weeklyHours?: DayHoursDto[];

  @ApiProperty({
    description: 'Tarifa de respaldo domicilio web (COP)',
    required: false,
    example: WEB_DELIVERY_DEFAULT_FEE,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  webDeliveryDefaultFee?: number;

  @ApiProperty({
    description: 'Cobertura máxima domicilio web (km de ruta)',
    required: false,
    example: WEB_DELIVERY_MAX_KM,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.5)
  webDeliveryMaxKm?: number;

  @ApiProperty({
    type: [WebDeliveryFeeTierDto],
    required: false,
    example: WEB_DELIVERY_FEE_TIERS,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WebDeliveryFeeTierDto)
  webDeliveryFeeTiers?: WebDeliveryFeeTierDto[];
}

export class CreateHolidayClosureDto {
  @ApiProperty({ example: '2026-12-25' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'closureDate debe ser YYYY-MM-DD' })
  closureDate: string;

  @ApiProperty({ example: 'Navidad' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name: string;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  allDay?: boolean;

  @ApiProperty({ required: false, example: '11:00' })
  @IsOptional()
  @Matches(HHMM, { message: 'startTime debe ser HH:mm' })
  startTime?: string;

  @ApiProperty({ required: false, example: '15:00' })
  @IsOptional()
  @Matches(HHMM, { message: 'endTime debe ser HH:mm' })
  endTime?: string;
}
