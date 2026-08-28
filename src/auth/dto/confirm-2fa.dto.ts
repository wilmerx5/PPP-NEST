import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class Confirm2faDto {
  @ApiProperty({ description: 'Código de 6 dígitos de la app authenticator', example: '123456' })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'El código debe tener 6 dígitos' })
  code: string;
}
