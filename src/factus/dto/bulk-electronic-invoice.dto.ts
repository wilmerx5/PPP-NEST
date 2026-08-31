import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
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

/** Preview: total + cantidad → plan de N facturas desde catálogo. */
export class BulkElectronicInvoicePreviewDto {
  @ApiProperty({
    description: 'Total objetivo en COP (suma aproximada de las facturas)',
    example: 1_000_000,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(1000)
  @Max(50_000_000)
  targetTotal: number;

  @ApiProperty({
    description: 'Cantidad de facturas a generar',
    example: 4,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(40)
  quantity: number;

  @ApiPropertyOptional({
    description: 'Desviación máxima (fracción, default 0.08)',
    example: 0.08,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  @Max(0.25)
  maxDeviationRatio?: number;
}

export class BulkInvoiceLineDto {
  @Type(() => Number)
  @IsInt()
  productId: number;

  @IsString()
  @MaxLength(120)
  name: string;

  @Type(() => Number)
  @IsInt()
  code: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(40)
  quantity: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  lineTotal: number;
}

export class BulkInvoicePlanDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  index: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  targetAmount: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sum: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkInvoiceLineDto)
  lines: BulkInvoiceLineDto[];
}

/** Emite el plan (o regenera con targetTotal+quantity). */
export class BulkElectronicInvoiceIssueDto {
  @ApiPropertyOptional({
    description: 'Plan del preview (recomendado). Si falta, se regenera con targetTotal+quantity.',
    type: [BulkInvoicePlanDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkInvoicePlanDto)
  invoices?: BulkInvoicePlanDto[];

  @ApiPropertyOptional({ example: 1_000_000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1000)
  @Max(50_000_000)
  targetTotal?: number;

  @ApiPropertyOptional({ example: 4 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(40)
  quantity?: number;

  @ApiPropertyOptional({ example: 0.08 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  @Max(0.25)
  maxDeviationRatio?: number;

  @ApiPropertyOptional({ example: '31' })
  @IsOptional()
  @IsString()
  @MaxLength(5)
  paymentMethodCode?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  sendEmail?: boolean;

  @ApiPropertyOptional({ maxLength: 250 })
  @IsOptional()
  @IsString()
  @MaxLength(250)
  observation?: string;
}
