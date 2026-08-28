import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

/**
 * Datos del adquiriente para FE manual desde tomar pedidos.
 * PPP es la fuente de verdad; estos campos solo completan lo que pide Factus/DIAN.
 */
export class IssueElectronicInvoiceDto {
  @ApiProperty({
    description: 'Tipo de documento DIAN: 13=cédula, 31=NIT, 22=cédula extranjería, etc.',
    example: '13',
  })
  @IsString()
  @IsIn(['11', '12', '13', '21', '22', '31', '41', '42', '47', '50', '91'])
  identificationDocumentCode: string;

  @ApiProperty({
    description: 'Número de identificación sin DV ni guion',
    example: '1234567890',
  })
  @IsString()
  @MinLength(5)
  @MaxLength(20)
  identification: string;

  @ApiPropertyOptional({ description: 'DV del NIT (opcional; Factus lo calcula si falta)' })
  @IsOptional()
  @IsString()
  @MaxLength(1)
  dv?: string;

  @ApiPropertyOptional({
    description:
      '1=persona jurídica, 2=persona natural. Opcional: se infiere (NIT→jurídica, resto→natural).',
    example: '2',
  })
  @IsOptional()
  @IsString()
  @IsIn(['1', '2'])
  legalOrganizationCode?: string;

  @ApiPropertyOptional({
    description: 'Nombre (obligatorio si persona natural)',
    example: 'Carlos López',
  })
  @ValidateIf((o: IssueElectronicInvoiceDto) => o.legalOrganizationCode === '2')
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  names?: string;

  @ApiPropertyOptional({
    description: 'Razón social (obligatorio si persona jurídica)',
  })
  @ValidateIf((o: IssueElectronicInvoiceDto) => o.legalOrganizationCode === '1')
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  company?: string;

  @ApiPropertyOptional({ example: 'cliente@email.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '3001234567' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({ example: 'Calle 10 # 20-30' })
  @IsOptional()
  @IsString()
  @MaxLength(250)
  address?: string;

  @ApiPropertyOptional({
    description: 'Código municipio DIAN (ej. 11001 Bogotá)',
    example: '11001',
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  municipalityCode?: string;

  @ApiPropertyOptional({
    description: 'Código método de pago DIAN: 10 efectivo, 31 transferencia, 47 Nequi/digital, etc.',
    example: '10',
  })
  @IsOptional()
  @IsString()
  @MaxLength(5)
  paymentMethodCode?: string;

  @ApiPropertyOptional({
    description: 'Si false, Factus no envía correo (default true)',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  sendEmail?: boolean;

  @ApiPropertyOptional({ maxLength: 250 })
  @IsOptional()
  @IsString()
  @MaxLength(250)
  observation?: string;
}
