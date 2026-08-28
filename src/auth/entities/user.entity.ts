import { ApiProperty } from "@nestjs/swagger";
import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { VerificationToken } from "./verification-token.entity";
import { Address } from "./address.entity";
import { Phone } from "./phone.entity";

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
    @Column({ select: false, nullable: true })
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
        required: false,
    })
    @Column({ nullable: true })
    phone: string;

    @ApiProperty({
        description: 'ID de Google OAuth.',
        example: '1234567890',
        required: false,
    })
    @Column({ name: 'google_id', nullable: true, unique: true })
    googleId: string;

    @ApiProperty({
        description: 'Proveedor de autenticación.',
        example: 'google',
        required: false,
    })
    @Column({ nullable: true, default: 'local' })
    provider: string;

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
        description: 'Si el usuario tiene 2FA TOTP activo.',
        example: false,
        default: false,
    })
    @Column({ name: 'totp_enabled', type: 'boolean', default: false })
    totpEnabled: boolean;

    @ApiProperty({
        description: 'Secreto TOTP (no se expone en respuestas).',
        required: false,
    })
    @Column({ name: 'totp_secret', type: 'varchar', length: 64, nullable: true, select: false })
    totpSecret: string | null;

    @ApiProperty({
        description: 'Códigos de recuperación hasheados (no se exponen).',
        required: false,
    })
    @Column({ name: 'totp_recovery_codes', type: 'simple-json', nullable: true, select: false })
    totpRecoveryCodes: string[] | null;

    @CreateDateColumn({
  name: 'created_at',
  type: 'timestamp',
})
createdAt: Date;

    @ApiProperty({
        description: 'Tokens asociados al usuario para verificación, activación, etc.',
        type: () => [VerificationToken],
        required: false,
    })
    @OneToMany(() => VerificationToken, (token) => token.user)
    verificationTokens: VerificationToken[];

    @ApiProperty({
        description: 'Direcciones asociadas al usuario.',
        type: () => [Address],
        required: false,
    })
    @OneToMany(() => Address, (address) => address.user)
    addresses: Address[];

    @ApiProperty({
        description: 'Teléfonos asociados al usuario.',
        type: () => [Phone],
        required: false,
    })
    @OneToMany(() => Phone, (phone) => phone.user)
    phones: Phone[];
}
