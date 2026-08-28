import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class FactusItemTaxLineDto {
  @ApiProperty({ example: '04', description: '04=INC impoconsumo, 01=IVA' })
  @IsString()
  @MaxLength(5)
  code: string;

  @ApiProperty({ example: 8, description: 'Tarifa en porcentaje (ej. 8 = 8%)' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  rate: number;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  isExcluded?: boolean;
}

export class UpdateFactusInvoiceSettingsDto {
  @ApiProperty({
    type: [FactusItemTaxLineDto],
    description: 'Impuestos aplicados a cada ítem de la FE (puede ser más de uno)',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => FactusItemTaxLineDto)
  itemTaxes: FactusItemTaxLineDto[];

  @ApiProperty({
    example: true,
    description: 'true si los precios del menú ya incluyen los impuestos listados',
  })
  @IsBoolean()
  pricesIncludeTax: boolean;
}
