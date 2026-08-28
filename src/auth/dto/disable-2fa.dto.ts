import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class Disable2faDto {
  @ApiProperty({
    description: 'Código TOTP de 6 dígitos o código de recuperación',
    example: '123456',
  })
  @IsString()
  @MinLength(6)
  code: string;
}
