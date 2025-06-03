import {
    Column,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn
} from 'typeorm';
import { Product } from './product.entity';
  
  @Entity('ppp_product_attributes')
  export class ProductAttribute {
    @PrimaryGeneratedColumn()
    id: number;
  
    @Column({ name: 'attribute_name', length: 100 })
    attributeName: string;
  
    @Column({ type: 'text' })
    options: string; // Puede almacenar JSON string con las opciones
  
    @ManyToOne(() => Product, (product) => product.attributes, {
        onDelete: 'CASCADE',
      })
      @JoinColumn({ name: 'product_id' }) // ✅ el campo correcto
      product: Product;
      
  }
  