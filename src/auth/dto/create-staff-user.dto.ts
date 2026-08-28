import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { ValidRoles } from '../interfaces/valid.roles.interface';
import { STAFF_ROLES } from '../staff.roles.util';

export class CreateStaffUserDto {
  @ApiProperty({ example: 'cocina@prontopolloportal.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ minLength: 6, example: 'Cocina2026!' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: 'María Cocina' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiPropertyOptional({ example: '3001234567' })
  @IsOptional()
  @IsString()
  @Matches(/^[0-9+\-() ]{7,20}$/, {
    message: 'El número de teléfono no es válido',
  })
  phone?: string;

  @ApiProperty({
    isArray: true,
    enum: STAFF_ROLES,
    example: [ValidRoles.kitchenUser],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(STAFF_ROLES, { each: true, message: 'Rol de staff inválido' })
  roles: ValidRoles[];
}
