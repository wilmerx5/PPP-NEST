import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, Length, MinLength } from "class-validator";

export class ResetPasswordDTO {

  @ApiProperty({
    description: 'Correo electrónico del usuario.',
    example: 'user@example.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Código de verificación enviado al correo. Debe tener exactamente 6 dígitos.',
    example: '493028',
    minLength: 6,
    maxLength: 6,
  })
  @Length(6, 6)
  @IsString()
  code: string;

  @ApiProperty({
    description: 'Nueva contraseña del usuario. Mínimo 6 caracteres.',
    example: 'newSecurePassword123',
    minLength: 6,
  })
  @MinLength(6)
  @IsString()
  newPassword: string;
}
