import { ApiProperty } from "@nestjs/swagger";
import { User } from "src/auth/entities/user.entity";
import {
    Column,
    CreateDateColumn,
    Entity,
    ManyToOne,
    PrimaryGeneratedColumn
} from "typeorm";

@Entity('ppp_verification_token')
export class VerificationToken {

  @ApiProperty({
    description: 'ID autogenerado del token de verificación.',
    example: 145,
  })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({
    description: 'Código de verificación enviado al usuario. Siempre de 6 dígitos.',
    example: '493028',
    minLength: 6,
    maxLength: 6,
  })
  @Column({ length: 6 })
  token: string;

  @ApiProperty({
    description: 'Fecha y hora de expiración del token.',
    example: '2025-11-14T20:45:50.000Z',
  })
  @Column()
  expiresAt: Date;

  @ApiProperty({
    description: 'Indica si el token ya fue utilizado.',
    example: false,
    default: false,
  })
  @Column({ default: false })
  isUsed: boolean;

  @ApiProperty({
    description: 'Fecha de creación del token. Se asigna de forma automática.',
    example: '2025-11-14T20:25:50.000Z',
  })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({
    description: 'Usuario al que pertenece este token.',
    type: () => User,
  })
  @ManyToOne(() => User, (user) => user.verificationTokens, {
    onDelete: 'CASCADE',
  })
  user: User;
}
