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

  // Relación inversa con productos
  @ManyToMany(() => Product, (product) => product.categories)
  products: Product[];

  @Column({ type: 'varchar', nullable: true })
  imageUrl: string;
}
