import {
    Column,
    CreateDateColumn,
    Entity,
    OneToMany,
    PrimaryGeneratedColumn,
} from 'typeorm';
import { OrderItem } from './order-item.entity';
export type OrderType = 'delivery' | 'pickup' | 'table'| 'counter';

@Entity('ppp_orders')
export class Order {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'customer_name', length: 100 })
    customerName: string;

    @Column({ length: 20 })
    phone: string;

    @Column({ type: 'text' })
    address: string;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
    items: OrderItem[];

    @Column({ name: 'daily_order_number', type: 'int', nullable: true })
    dailyOrderNumber: number;


    @Column({
        type: 'enum',
        enum: ['delivery', 'pickup', 'table','counter'],
        default: 'pickup',
        name:"order_type"
    })
    orderType: OrderType;
}
