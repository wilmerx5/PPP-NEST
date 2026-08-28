import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { ValidRoles } from '../interfaces/valid.roles.interface';
import { STAFF_ROLES } from '../staff.roles.util';

export class UpdateStaffUserDto {
  @ApiPropertyOptional({ example: 'María Cocina' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  fullName?: string;

  @ApiPropertyOptional({ example: '3001234567' })
  @IsOptional()
  @IsString()
  @Matches(/^[0-9+\-() ]{7,20}$/, {
    message: 'El número de teléfono no es válido',
  })
  phone?: string;

  @ApiPropertyOptional({ isArray: true, enum: STAFF_ROLES })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(STAFF_ROLES, { each: true, message: 'Rol de staff inválido' })
  roles?: ValidRoles[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ minLength: 6 })
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;
}
