import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, MinLength } from "class-validator";

export class LogInUserDTO {

  @ApiProperty({
    description: 'Correo electrónico del usuario registrado.',
    example: 'user@example.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Contraseña del usuario. Debe tener mínimo 6 caracteres.',
    example: 'mySecurePassword123',
    minLength: 6,
  })
  @IsString()
  @MinLength(6)
  password: string;
}
