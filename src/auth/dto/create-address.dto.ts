import { ApiProperty } from "@nestjs/swagger";
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsBoolean,
  MaxLength,
  IsNumber,
  Min,
  Max,
} from "class-validator";
import { Type } from "class-transformer";

export class CreateAddressDto {
  @ApiProperty({
    description: 'Nombre descriptivo de la dirección (ej: Casa, Trabajo, etc.).',
    example: 'Casa',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  label: string;

  @ApiProperty({
    description: 'Dirección completa.',
    example: 'Calle 123 #45-67, Bogotá',
  })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiProperty({
    description: 'Indica si esta es la dirección por defecto.',
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiProperty({
    description: 'Tipo de dirección.',
    example: 'home',
    enum: ['home', 'work', 'other'],
    required: false,
  })
  @IsOptional()
  @IsEnum(['home', 'work', 'other'])
  type?: 'home' | 'work' | 'other';

  @ApiProperty({
    description: 'Información adicional (barrio, referencias, etc.).',
    example: 'Cerca del parque principal',
    required: false,
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({
    description: 'Latitud del pin confirmado en el mapa.',
    example: 4.6323,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @ApiProperty({
    description: 'Longitud del pin confirmado en el mapa.',
    example: -74.1472,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;

  @ApiProperty({
    description: 'Si el usuario ya confirmó la ubicación en el mapa.',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  locationConfirmed?: boolean;
}

export class GeocodeAddressDto {
  @ApiProperty({
    description: 'Texto de dirección a ubicar en el mapa.',
    example: 'Calle 123 #45-67, Kennedy, Bogotá',
  })
  @IsString()
  @IsNotEmpty()
  address: string;
}

export class ReverseGeocodeDto {
  @ApiProperty({ description: 'Latitud del pin confirmado.', example: 4.6323 })
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @ApiProperty({ description: 'Longitud del pin confirmado.', example: -74.1472 })
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;
}
