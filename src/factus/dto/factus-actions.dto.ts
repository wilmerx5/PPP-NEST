import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ResendElectronicInvoiceEmailDto {
  @ApiProperty({ example: 'cliente@email.com' })
  @IsEmail()
  email: string;
}

export class CancelElectronicInvoiceDto {
  @ApiPropertyOptional({
    description: 'Motivo / observación de la nota crédito',
    example: 'Anulación solicitada por el cliente',
  })
  @IsOptional()
  @IsString()
  @MaxLength(250)
  observation?: string;

  @ApiPropertyOptional({
    description: 'Código concepto corrección DIAN (2 = anulación factura)',
    example: '2',
    default: '2',
  })
  @IsOptional()
  @IsString()
  @MaxLength(5)
  correctionConceptCode?: string;
}

export class LookupInvoiceCustomerQueryDto {
  @ApiProperty({ example: '31' })
  @IsString()
  @MinLength(1)
  @MaxLength(5)
  identificationDocumentCode: string;

  @ApiProperty({ example: '901234567' })
  @IsString()
  @MinLength(5)
  @MaxLength(20)
  identification: string;
}
