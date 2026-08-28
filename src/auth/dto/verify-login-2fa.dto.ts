import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class VerifyLogin2faDto {
  @ApiProperty({ description: 'Token temporal emitido tras login con contraseña' })
  @IsString()
  @IsNotEmpty()
  tempToken: string;

  @ApiProperty({
    description: 'Código TOTP de 6 dígitos o código de recuperación',
    example: '123456',
  })
  @IsString()
  @MinLength(6)
  code: string;
}
