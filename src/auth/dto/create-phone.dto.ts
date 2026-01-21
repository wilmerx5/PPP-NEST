import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsNotEmpty, IsOptional, IsEnum, IsBoolean, MaxLength } from "class-validator";

export class CreatePhoneDto {
  @ApiProperty({
    description: 'Número de teléfono.',
    example: '+57 300 123 4567',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  number: string;

  @ApiProperty({
    description: 'Nombre descriptivo del teléfono (ej: Personal, Trabajo, etc.).',
    example: 'Personal',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  label: string;

  @ApiProperty({
    description: 'Indica si este es el teléfono por defecto.',
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiProperty({
    description: 'Tipo de teléfono.',
    example: 'mobile',
    enum: ['mobile', 'home', 'work', 'other'],
    required: false,
  })
  @IsOptional()
  @IsEnum(['mobile', 'home', 'work', 'other'])
  type?: 'mobile' | 'home' | 'work' | 'other';
}
