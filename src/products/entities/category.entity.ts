import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  Entity,
  ManyToMany,
  PrimaryGeneratedColumn
} from 'typeorm';
import { Product } from './product.entity';

@Entity('ppp_categories')
export class Category {

  @ApiProperty({
    description: 'ID autoincremental de la categoría.',
    example: 1,
  })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({
    description: 'Nombre único de la categoría.',
    example: 'Bebidas',
    maxLength: 100,
  })
  @Column({ length: 100, unique: true })
  name: string;

  @ApiProperty({
    description: 'Lista de productos asociados a esta categoría.',
    type: () => [Product],
    required: false,
  })
  @ManyToMany(() => Product, (product) => product.categories)
  products: Product[];

  @ApiProperty({
    description: 'URL de la imagen asociada a la categoría.',
    example: 'https://cdn.misitio.com/categories/bebidas.png',
    required: false,
  })
  @Column({ type: 'varchar', nullable: true, name: 'image_url' })
  imageUrl: string;
}
