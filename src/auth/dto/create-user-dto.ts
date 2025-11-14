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

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsString()
  @Matches(/^[0-9+\-() ]{7,20}$/, {
    message: 'El número de teléfono no es válido'
  })
  phone: string;

  @IsArray()
  @IsString({ each: true })
  @IsEnum(ValidRoles, {
    each: true,
    message: 'Rol inválido',
  })
  roles: ValidRoles[];
}
