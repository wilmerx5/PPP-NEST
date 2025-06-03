import {
  Column,
  Entity,
  JoinTable,
  ManyToMany,
  OneToMany,
  PrimaryGeneratedColumn
} from 'typeorm';
import { Category } from './category.entity';
//import { OrderItem } from './product-attribute.entity';
import { OrderItem } from 'src/orders/entities/order-item.entity';
import { ProductAttribute } from './product-attribute.entity';
  
  @Entity('ppp_products')
  export class Product {
    @PrimaryGeneratedColumn()
    id: number;
  
    @Column({ length: 100 })
    name: string;
  
    @Column({ type: 'text', nullable: true })
    description?: string;
  
    @Column({ type: 'decimal', precision: 10, scale: 2 })
    price: number;
  
    @Column({ name: 'has_attributes', type: 'boolean', default: false })
    hasAttributes: boolean;
  
    @Column({ type: 'int', unique: true })
    code: number;
  
    // 🧩 Relación con atributos configurables
    @OneToMany(() => ProductAttribute, (attr) => attr.product, { cascade: true })
    attributes: ProductAttribute[];
  
    // 🧩 Relación muchos a muchos con categorías
    @ManyToMany(() => Category, (category) => category.products, { cascade: true })
    @JoinTable({
      name: 'ppp_product_categories',
      joinColumn: { name: 'product_id', referencedColumnName: 'id' },
      inverseJoinColumn: { name: 'category_id', referencedColumnName: 'id' },
    })
    categories: Category[];
  
    // 🧩 Relación con items en órdenes
    @OneToMany(() => OrderItem, (item) => item.product)
    orderItems: OrderItem[];
  }
  
