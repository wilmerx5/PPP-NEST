import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsNotEmpty, IsOptional, IsEnum, IsBoolean, MaxLength } from "class-validator";

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
}
