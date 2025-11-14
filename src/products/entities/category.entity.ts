import {
  Column,
  Entity,
  ManyToMany,
  PrimaryGeneratedColumn
} from 'typeorm';
import { Product } from './product.entity';

@Entity('ppp_categories')
export class Category {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100, unique: true })
  name: string;

  
  @ManyToMany(() => Product, (product) => product.categories)
  products: Product[];

  @Column({ type: 'varchar', nullable: true, name:'image_url' })
  imageUrl: string;
}
