import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber, IsBoolean, IsArray, ValidateNested, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateProductAttributeDto {
  @ApiProperty({ description: 'ID del atributo (opcional, para actualizar existente)', required: false })
  @IsOptional()
  @IsNumber()
  id?: number;

  @ApiProperty({ description: 'Nombre del atributo', example: 'Salsa' })
  @IsString()
  @IsNotEmpty()
  attributeName: string;

  @ApiProperty({ description: 'Opciones disponibles (array de strings)', example: ['Dulce', 'Picante', 'BBQ'], type: [String] })
  @IsArray()
  @IsString({ each: true })
  options: string[];
}

export class UpdateVariantStockItemDto {
  @ApiProperty({ example: 'Limonada' })
  @IsString()
  attributeValue: string;
  @ApiProperty({ example: 10 })
  @IsNumber()
  stock: number;
}

export class UpdateVariantStockAttributeDto {
  @ApiProperty({ example: 'Sabor', description: 'Nombre del atributo (ej. Sabor, Tamaño)' })
  @IsString()
  attributeName: string;
  /** Si false, se deja de manejar stock por este atributo (se borran las filas de variante). */
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  trackStock?: boolean;
  @ApiProperty({ type: [UpdateVariantStockItemDto], description: 'Stock por cada opción (solo si trackStock !== false)' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateVariantStockItemDto)
  stocks?: UpdateVariantStockItemDto[];
}

export class UpdateProductDto {
  @ApiProperty({ description: 'Nombre del producto', example: 'Pollo Asado Familiar', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ description: 'Descripción del producto', example: 'Pollo asado a la leña acompañado de papas criollas.', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Precio del producto', example: 29900, required: false })
  @IsOptional()
  @IsNumber()
  price?: number;

  @ApiProperty({ description: 'Indica si el producto tiene atributos configurables', example: true, required: false })
  @IsOptional()
  @IsBoolean()
  hasAttributes?: boolean;

  @ApiProperty({ 
    description: 'Lista de atributos del producto', 
    type: [UpdateProductAttributeDto],
    required: false 
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateProductAttributeDto)
  attributes?: UpdateProductAttributeDto[];

  @ApiProperty({ 
    description: 'IDs de las categorías a las que pertenece el producto', 
    example: [1, 2, 3],
    type: [Number],
    required: false 
  })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  categoryIds?: number[];

  @ApiProperty({ description: 'Si se controla inventario para este producto', example: false, required: false })
  @IsOptional()
  @IsBoolean()
  trackInventory?: boolean;

  @ApiProperty({ description: 'Unidades en stock (solo si trackInventory = true)', example: 0, required: false })
  @IsOptional()
  @IsNumber()
  stock?: number;

  /** Stock por variante (por atributo). Ej. Sabor → Limonada: 10, Gaseosa: 5. Si se envía, reemplaza todo el stock por atributo indicado. */
  @ApiProperty({
    type: [UpdateVariantStockAttributeDto],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateVariantStockAttributeDto)
  variantStocks?: UpdateVariantStockAttributeDto[];

  /** También descontar de (productos que no están en grupos): ID del producto destino. */
  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  alsoDeductProductId?: number | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  alsoDeductAttributeName?: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  alsoDeductAttributeValue?: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  alsoDeductBaseUnits?: number | null;
}
