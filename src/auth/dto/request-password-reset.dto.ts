import { ApiProperty } from "@nestjs/swagger";
import { IsEmail } from "class-validator";

export class RequestPasswordResetDTO {

  @ApiProperty({
    description: 'Correo electrónico registrado al que se enviará un código de recuperación de contraseña.',
    example: 'user@example.com',
  })
  @IsEmail()
  email: string;
}
