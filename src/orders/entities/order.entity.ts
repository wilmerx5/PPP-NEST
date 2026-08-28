import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { OrderItem } from './order-item.entity';
import { OrderExtra } from './order-extra.entity';

export type OrderType = 'delivery' | 'pickup' | 'table' | 'counter' | 'rappi';

/** Origen de la orden: online = cliente/ppp-front (pago); internal = panel orders-ppp-front o ppp-mesas */
export type OrderSource = 'online' | 'internal' | 'whatsapp';

export type OrderStatus =
  | 'pending'    // Recién creada / confirmada
  | 'cooking'   // En preparación (cocina)
  | 'cooked'    // Lista (cocina terminó)
  | 'packing'   // Empacando (para delivery)
  | 'inDelivery'// En camino (delivery)
  | 'completed' // Entregada / Recogida / Completada
  | 'canceled'; // Cancelada

@Entity({ name: 'ppp_orders', synchronize: true })
export class Order {

  @ApiProperty({
    description: 'ID autogenerado de la orden.',
    example: 125,
  })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({
    description: 'Nombre del cliente que realiza la orden.',
    example: 'Carlos López',
  })
  @Column({ name: 'customer_name', length: 100 })
  customerName: string;

  @ApiProperty({
    description: 'Número telefónico del cliente.',
    example: '+57 300 456 7890',
  })
  @Column({ length: 20 })
  phone: string;

  @ApiProperty({
    description: 'Dirección de entrega del cliente.',
    example: 'Calle 123 #45-67, Bogotá',
  })
  @Column({ type: 'text' })
  address: string;

  @ApiProperty({
    description: 'Email del cliente (para vincular con usuario y "Mis pedidos").',
    example: 'cliente@example.com',
    nullable: true,
  })
  @Column({ name: 'customer_email', type: 'varchar', length: 255, nullable: true })
  customerEmail?: string | null;

  @ApiProperty({
    description: 'Fecha de creación de la orden.',
    example: '2025-11-14T20:12:00.000Z',
  })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty({
    description: 'Lista de items incluidos en la orden.',
    type: () => [OrderItem],
  })
  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
  items: OrderItem[];

  @ApiProperty({
    description: 'Número consecutivo de la orden dentro del día.',
    example: 7,
    nullable: true,
  })
  @Column({ name: 'daily_order_number', type: 'int', nullable: true })
  dailyOrderNumber: number;

  @ApiProperty({
    description: 'Tipo de la orden.',
    example: 'pickup',
    enum: ['delivery', 'pickup', 'table', 'counter', 'rappi'],
  })
  @Column({
    type: 'enum',
    enum: ['delivery', 'pickup', 'table', 'counter', 'rappi'],
    default: 'pickup',
    name: 'order_type',
  })
  orderType: OrderType;

  @ApiProperty({
    description: 'Estado actual de la orden.',
    example: 'cooking',
    enum: ['pending', 'cooking', 'cooked', 'packing', 'canceled', 'inDelivery', 'completed'],
  })
  @Column({
    type: 'enum',
    enum: ['pending', 'cooking', 'cooked', 'packing', 'canceled', 'inDelivery', 'completed'],
    default: 'cooking',
    name: 'order_status',
  })
  orderStatus: OrderStatus;

  @ApiProperty({
    description: 'Costo del servicio de delivery. Se guarda solo si el tipo de orden es delivery.',
    example: 5000,
    nullable: true,
  })
  @Column({
    name: 'delivery_fee',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    default: 0,
  })
  deliveryFee: number;

  @ApiProperty({
    description: 'Indica si la orden ya fue impresa.',
    example: false,
  })
  @Column({ type: 'boolean', default: false })
  printed: boolean;

  @ApiProperty({
    description: 'Origen: online = cliente/ppp-front (pago); internal = panel orders-ppp-front o ppp-mesas.',
    example: 'online',
    enum: ['online', 'internal', 'whatsapp'],
  })
  @Column({
    name: 'order_source',
    type: 'varchar',
    length: 20,
    default: 'internal',
  })
  orderSource: OrderSource;

  @ApiProperty({
    description: 'Puntos generados por esta orden (basados en productos con códigos específicos).',
    example: 3,
    nullable: true,
  })
  @Column({ name: 'points', type: 'int', nullable: true, default: 0 })
  points: number;

  @ApiProperty({
    description: 'Código de premio de redención aplicado a esta orden (null si no se aplicó ningún premio).',
    example: 'REDEEM9PTSX7',
    nullable: true,
  })
  @Column({ name: 'redemption_code', type: 'varchar', length: 12, nullable: true })
  redemptionCode: string | null;

  @ApiProperty({
    description: 'ID de grupo cuando varias mesas comparten cuenta (mesas linkeadas).',
    example: 1735123456789,
    nullable: true,
  })
  @Column({ name: 'table_group_id', type: 'bigint', nullable: true })
  tableGroupId: number | null;

  @ApiProperty({
    description: 'Clave de idempotencia del cliente (evita órdenes duplicadas por reintentos).',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    nullable: true,
  })
  @Column({ name: 'client_request_id', type: 'varchar', length: 64, nullable: true, unique: true })
  clientRequestId: string | null;

  @ApiProperty({
    description: 'Adicionales o extras de la orden (platos, cubiertos, etc.).',
    type: () => OrderExtra,
    required: false,
  })
  @OneToMany(() => OrderExtra, (e) => e.order, { cascade: true })
  extras?: OrderExtra[];

  // --- Facturación electrónica (Factus). Emisión manual desde tomar pedidos. ---

  @Column({
    name: 'electronic_invoice_status',
    type: 'varchar',
    length: 20,
    default: 'none',
  })
  electronicInvoiceStatus:
    | 'none'
    | 'pending'
    | 'accepted'
    | 'rejected'
    | 'error'
    | 'credit_noted';

  @Column({
    name: 'electronic_invoice_reference',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  electronicInvoiceReference: string | null;

  @Column({
    name: 'electronic_invoice_number',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  electronicInvoiceNumber: string | null;

  @Column({
    name: 'electronic_invoice_cufe',
    type: 'varchar',
    length: 128,
    nullable: true,
  })
  electronicInvoiceCufe: string | null;

  @Column({
    name: 'electronic_invoice_public_url',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  electronicInvoicePublicUrl: string | null;

  @Column({
    name: 'electronic_invoice_qr_url',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  electronicInvoiceQrUrl: string | null;

  @Column({
    name: 'electronic_invoice_issued_at',
    type: 'timestamp',
    nullable: true,
  })
  electronicInvoiceIssuedAt: Date | null;

  @Column({
    name: 'electronic_invoice_error',
    type: 'varchar',
    length: 1000,
    nullable: true,
  })
  electronicInvoiceError: string | null;

  @Column({
    name: 'electronic_credit_note_number',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  electronicCreditNoteNumber: string | null;

  @Column({
    name: 'electronic_credit_note_cufe',
    type: 'varchar',
    length: 128,
    nullable: true,
  })
  electronicCreditNoteCufe: string | null;

  @Column({
    name: 'electronic_credit_note_public_url',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  electronicCreditNotePublicUrl: string | null;

  @Column({
    name: 'electronic_credit_note_issued_at',
    type: 'timestamp',
    nullable: true,
  })
  electronicCreditNoteIssuedAt: Date | null;

  @Column({
    name: 'invoice_customer_doc_type',
    type: 'varchar',
    length: 5,
    nullable: true,
  })
  invoiceCustomerDocType: string | null;

  @Column({
    name: 'invoice_customer_doc_number',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  invoiceCustomerDocNumber: string | null;

  @Column({
    name: 'invoice_customer_doc_dv',
    type: 'varchar',
    length: 1,
    nullable: true,
  })
  invoiceCustomerDocDv: string | null;
}
