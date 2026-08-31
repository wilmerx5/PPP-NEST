import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** FE emitida desde lote admin (sin orden PPP vinculada). */
@Entity({ name: 'ppp_factus_standalone_invoices' })
@Index(['issuedAt'])
@Index(['invoiceNumber'])
export class FactusStandaloneInvoice {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'batch_id', type: 'varchar', length: 64 })
  batchId: string;

  @Column({ name: 'batch_index', type: 'int' })
  batchIndex: number;

  @Column({ name: 'reference_code', type: 'varchar', length: 100 })
  referenceCode: string;

  @Column({ name: 'customer_name', type: 'varchar', length: 100, default: 'Consumidor final' })
  customerName: string;

  @Column({ name: 'invoice_status', type: 'varchar', length: 20, default: 'pending' })
  invoiceStatus: string;

  @Column({ name: 'invoice_number', type: 'varchar', length: 64, nullable: true })
  invoiceNumber: string | null;

  @Column({ name: 'invoice_cufe', type: 'varchar', length: 128, nullable: true })
  invoiceCufe: string | null;

  @Column({ name: 'public_url', type: 'varchar', length: 500, nullable: true })
  publicUrl: string | null;

  @Column({ name: 'qr_url', type: 'varchar', length: 500, nullable: true })
  qrUrl: string | null;

  @Column({ name: 'issued_at', type: 'timestamp', nullable: true })
  issuedAt: Date | null;

  @Column({ name: 'invoice_error', type: 'varchar', length: 1000, nullable: true })
  invoiceError: string | null;

  @Column({ name: 'planned_sum', type: 'int', default: 0 })
  plannedSum: number;

  @Column({ name: 'invoice_customer_doc_type', type: 'varchar', length: 5, nullable: true })
  invoiceCustomerDocType: string | null;

  @Column({ name: 'invoice_customer_doc_number', type: 'varchar', length: 20, nullable: true })
  invoiceCustomerDocNumber: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
