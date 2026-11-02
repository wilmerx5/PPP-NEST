import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';
@Entity('ppp_bold_online_settings')
export class BoldOnlineSettings {
  @PrimaryColumn({ length: 40 }) id: string;
  @Column({ type: 'text' }) identityKeyEnc: string;
}
@Entity('ppp_bold_qr_attempts')
export class BoldQrAttempt {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ length: 80, unique: true }) requestKey: string;
  @Column({ length: 80, unique: true }) reference: string;
  @Column({ length: 36 }) createdBy: string;
  @Column({ length: 100 }) merchantId: string;
  @Column({ type: 'decimal', precision: 14, scale: 2 }) amount: string;
  @Column({ length: 20 }) status: string;
  @Column({ type: 'varchar', length: 100, nullable: true }) transactionId:
    | string
    | null;
  @Column({ type: 'mediumtext', nullable: true }) qrImage: string | null;
  @Column({ type: 'datetime', precision: 3, nullable: true })
  expiresAt: Date | null;
  @Column({ type: 'datetime', precision: 3 }) intentExpiresAt: Date;
  @Column({ type: 'varchar', length: 200, nullable: true }) error:
    | string
    | null;
  @Column({ type: 'datetime', precision: 3, nullable: true })
  lastCheckedAt: Date | null;
  @CreateDateColumn({ precision: 3 }) createdAt: Date;
}
