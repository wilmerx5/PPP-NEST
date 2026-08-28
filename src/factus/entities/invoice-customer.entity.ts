import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Cliente fiscal guardado al emitir FE (autocomplete en próximas facturas). */
@Entity({ name: 'ppp_invoice_customers' })
@Index(['identificationDocumentCode', 'identification'], { unique: true })
export class InvoiceCustomer {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'identification_document_code', type: 'varchar', length: 5 })
  identificationDocumentCode: string;

  @Column({ type: 'varchar', length: 20 })
  identification: string;

  @Column({ type: 'varchar', length: 1, nullable: true })
  dv: string | null;

  @Column({ name: 'legal_organization_code', type: 'varchar', length: 1 })
  legalOrganizationCode: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  names: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  company: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 250, nullable: true })
  address: string | null;

  @Column({ name: 'municipality_code', type: 'varchar', length: 10, nullable: true })
  municipalityCode: string | null;

  @Column({ name: 'times_used', type: 'int', default: 1 })
  timesUsed: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
