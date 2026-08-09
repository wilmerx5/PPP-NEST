import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  UpdateProductAttributeDto,
  UpdateProductScheduleDto,
  UpdateVariantStockAttributeDto,
} from './update-product.dto';

export class CreateProductDto {
  @ApiProperty({ example: 'Pollo Asado Familiar' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 29900 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty({
    description: 'Código único del producto (POS / pedidos rápidos).',
    example: 101,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  code: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  hasAttributes?: boolean;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  trackInventory?: boolean;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  stock?: number;

  @ApiProperty({ type: [UpdateProductAttributeDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateProductAttributeDto)
  attributes?: UpdateProductAttributeDto[];

  @ApiProperty({ type: [Number], required: false })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  categoryIds?: number[];

  @ApiProperty({ type: [UpdateVariantStockAttributeDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateVariantStockAttributeDto)
  variantStocks?: UpdateVariantStockAttributeDto[];

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  hasSchedule?: boolean;

  @ApiProperty({ type: [UpdateProductScheduleDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateProductScheduleDto)
  schedules?: UpdateProductScheduleDto[];
}
