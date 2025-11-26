import { ApiProperty } from "@nestjs/swagger";
import { IsString, Length } from "class-validator";

export class ValidateTokenDTO {

  @ApiProperty({
    description: 'ID del usuario al que pertenece el token. Generalmente un UUID.',
    example: 'f2a1bd87-acc8-45b6-9d13-65e7bd982a2a',
  })
  @IsString()
  idUser: string;

  @ApiProperty({
    description: 'Código de verificación enviado al correo. Debe tener exactamente 6 dígitos.',
    example: '493028',
    minLength: 6,
    maxLength: 6,
  })
  @Length(6, 6)
  @IsString()
  otp: string;
}
