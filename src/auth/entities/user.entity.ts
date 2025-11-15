import { ApiProperty } from "@nestjs/swagger";
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { VerificationToken } from "./verification-token.entity";

@Entity('ppp_users')
export class User {

    @ApiProperty({
        description: 'UUID único del usuario.',
        example: 'a3f1c9a9-7431-4e74-aed2-db70762e99ad',
    })
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ApiProperty({
        description: 'Correo electrónico del usuario. Debe ser único.',
        example: 'user@example.com',
    })
    @Column({ unique: true })
    email: string;

    @ApiProperty({
        description: 'Contraseña del usuario (no se expone en respuestas).',
        example: 'hashedPassword123',
        required: false,
    })
    @Column({ select: false })
    password: string;

    @ApiProperty({
        description: 'Nombre completo del usuario.',
        example: 'Juan Pérez',
    })
    @Column()
    fullName: string;

    @ApiProperty({
        description: 'Estado de activación del usuario.',
        example: false,
        default: false,
    })
    @Column('boolean', { default: false })
    isActive: boolean;

    @ApiProperty({
        description: 'Número de teléfono del usuario.',
        example: '+57 300 123 4567',
    })
    @Column()
    phone: string;

    @ApiProperty({
        description: 'Roles asignados al usuario.',
        example: ['user', 'admin'],
        isArray: true,
        type: String,
        nullable: true,
    })
    @Column('simple-json', { nullable: true })
    roles: string[];

    @ApiProperty({
        description: 'Tokens asociados al usuario para verificación, activación, etc.',
        type: () => [VerificationToken],
        required: false,
    })
    @OneToMany(() => VerificationToken, (token) => token.user)
    verificationTokens: VerificationToken[];
}
