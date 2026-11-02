import {
  IsEmail,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
export class BoldOnlineKeyDto {
  @IsString()
  @MinLength(16)
  @MaxLength(512)
  @Matches(/^\S+$/)
  identityKey: string;
}
export class CreateBoldQrDto {
  @IsUUID() requestId: string;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(1000) @Max(10000000) amount: number;
  @IsInt() @Min(10) @Max(120) durationMinutes: number = 60;
  @IsString() @MinLength(2) @MaxLength(160) payerName: string;
  @IsOptional() @IsEmail() @MaxLength(254) payerEmail?: string;
  @IsOptional() @IsString() @Matches(/^\d{10}$/) payerPhone?: string;
  @IsOptional() @IsString() @Matches(/^\d{5,15}$/) payerDocument?: string;
}
