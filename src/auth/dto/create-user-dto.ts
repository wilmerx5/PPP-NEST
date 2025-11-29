import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  Matches,
  MinLength
} from 'class-validator';
import { ValidRoles } from '../interfaces/valid.roles.interface';

export class CreateUserDTO {

  @ApiProperty({
    description: 'Correo electrónico del usuario. Debe ser único.',
    example: 'user@example.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Contraseña del usuario. Mínimo 6 caracteres.',
    example: 'mySecurePass123',
    minLength: 6,
  })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({
    description: 'Nombre completo del usuario.',
    example: 'Juan Pérez',
  })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({
    description: 'Número de teléfono en formato internacional o nacional.',
    example: '+57 300 123 4567',
    pattern: '^[0-9+\\-() ]{7,20}$',
  })
  @IsString()
  @Matches(/^[0-9+\-() ]{7,20}$/, {
    message: 'El número de teléfono no es válido',
  })
  phone: string;

  @ApiProperty({
    description: 'Roles del usuario. Debe contener solo roles válidos.',
    example: Object.values(ValidRoles),
    isArray: true,
    enum: ValidRoles,
  })
  @IsArray()
  @IsString({ each: true })
  @IsEnum(ValidRoles, {
    each: true,
    message: 'Rol inválido',
  })
  roles: ValidRoles[];
}
