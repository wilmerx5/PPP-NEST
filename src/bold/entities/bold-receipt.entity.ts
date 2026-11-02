import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
@Entity('ppp_bold_receipts')
export class BoldReceipt {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ length: 100, unique: true }) paymentId: string;
  @Column({ length: 100 }) merchantId: string;
  @Column({ type: 'decimal', precision: 14, scale: 2 }) amount: string;
  @Column({ length: 3 }) currency: string;
  @Column({ length: 24 }) status: 'approved' | 'rejected' | 'voided';
  @Column({ length: 40 }) method: string;
  @Column({ length: 24, default: 'webhook' }) confirmationSource: string;
  @Column({ type: 'datetime', precision: 3 }) paidAt: Date;
  @CreateDateColumn({ precision: 3 }) receivedAt: Date;
  @Column({ type: 'varchar', length: 255, nullable: true }) payerEmail:
    | string
    | null;
  @Column({ type: 'varchar', length: 160, nullable: true }) payerName:
    | string
    | null;
  @Column({ type: 'varchar', length: 36, nullable: true }) claimedBy:
    | string
    | null;
  @Column({ type: 'varchar', length: 160, nullable: true }) claimedByName:
    | string
    | null;
  @Column({ type: 'datetime', precision: 3, nullable: true })
  claimedAt: Date | null;
  @Index({ unique: true })
  @Column({ type: 'int', nullable: true })
  orderId: number | null;
  @Column({ type: 'decimal', precision: 14, scale: 2, nullable: true })
  advanceAmount: string | null;
  @Column({ type: 'varchar', length: 36, nullable: true }) returnedBy:
    | string
    | null;
  @Column({ type: 'varchar', length: 160, nullable: true }) returnedByName:
    | string
    | null;
  @Column({ type: 'datetime', precision: 3, nullable: true })
  returnedAt: Date | null;
}
@Entity('ppp_bold_events')
export class BoldEvent {
  @PrimaryGeneratedColumn() id: number;
  @Column({ length: 100, unique: true }) eventId: string;
  @Column({ length: 100 }) paymentId: string;
  @Column({ length: 30 }) type: string;
  @Column({ length: 64 }) bodyHash: string;
  @CreateDateColumn({ precision: 3 }) receivedAt: Date;
}
