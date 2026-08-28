import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateInvoiceCustomerDto {
  @ApiPropertyOptional({ example: '13' })
  @IsOptional()
  @IsString()
  @IsIn(['11', '12', '13', '21', '22', '31', '41', '42', '47', '50', '91'])
  identificationDocumentCode?: string;

  @ApiPropertyOptional({ example: '1234567890' })
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(20)
  identification?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1)
  dv?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(150)
  names?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(150)
  company?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(250)
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10)
  municipalityCode?: string;
}
