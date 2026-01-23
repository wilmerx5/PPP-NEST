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
}
