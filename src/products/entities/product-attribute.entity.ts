import { ApiProperty } from '@nestjs/swagger';
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

  @ApiProperty({
    description: 'ID autogenerado del atributo.',
    example: 12,
  })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({
    description: 'Nombre del atributo asociado al producto.',
    example: 'Salsa',
    maxLength: 100,
  })
  @Column({ name: 'attribute_name', length: 100 })
  attributeName: string;

  @ApiProperty({
    description:
      'Opciones disponibles para este atributo. Se almacena como JSON string y se convierte a array al retornar.',
    example: '["Dulce", "Picante", "BBQ"]',
    type: String,
  })
  @Column({ type: 'text' })
  options: string;

  @ApiProperty({
    description: 'Producto al que pertenece este atributo.',
    type: () => Product,
  })
  @ManyToOne(() => Product, (product) => product.attributes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'product_id' })
  product: Product;
}
