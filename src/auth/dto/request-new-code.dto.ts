import { ApiProperty } from "@nestjs/swagger";
import { IsEmail } from "class-validator";

export class RequestNewCodeDTO {

  @ApiProperty({
    description: 'Correo electrónico registrado al que se enviará un nuevo código de verificación.',
    example: 'user@example.com',
  })
  @IsEmail()
  email: string;
}
