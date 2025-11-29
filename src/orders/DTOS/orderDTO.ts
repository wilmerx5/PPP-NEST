import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus, OrderType } from "../entities/order.entity";

export class CreateOrderItemAttributeDto {

  @ApiProperty({
    description: 'Nombre del atributo seleccionable en el producto.',
    example: 'Salsa',
  })
  attributeName: string;

  @ApiProperty({
    description: 'Valor seleccionado para el atributo.',
    example: 'BBQ',
  })
  attributeValue: string;
}

export class CreateOrderItemDto {

  @ApiProperty({
    description: 'ID del producto seleccionado.',
    example: 12,
  })
  productId: number;

  @ApiProperty({
    description: 'Nota opcional para el producto (picado, sin cebolla, etc).',
    example: 'Bien tostado',
    required: false,
  })
  note?: string;

  @ApiProperty({
    description: 'Lista de atributos seleccionados para este producto.',
    required: false,
    type: [CreateOrderItemAttributeDto],
  })
  attributes?: {
    attributeName: string;
    attributeValue: string;
  }[];
}

export class CreateOrderDto {

  @ApiProperty({
    description: 'Nombre del cliente que realiza la orden.',
    example: 'Carlos Pérez',
  })
  customerName: string;

  @ApiProperty({
    description: 'Teléfono del cliente.',
    example: '+57 300 456 7890',
  })
  phone: string;

  @ApiProperty({
    description: 'Dirección del cliente.',
    example: 'Calle 123 #45-67, Bogotá',
  })
  address: string;

  @ApiProperty({
    description: 'Tipo de orden: domicilio, mesa o recoger.',
    example:   "'delivery' | 'pickup' | 'table' | 'counter'",
    required: false,
  })
  orderType?: OrderType;

  @ApiProperty({
    description: 'Lista de productos incluidos en la orden.',
    type: [CreateOrderItemDto],
  })
  items: CreateOrderItemDto[];
}

export class UpdateOrderItemAttributeDto {

  @ApiProperty({
    description: 'Nombre del atributo a modificar.',
    example: 'Bebida',
  })
  attributeName: string;

  @ApiProperty({
    description: 'Nuevo valor del atributo.',
    example: 'Gaseosa',
  })
  attributeValue: string;
}

export class UpdateOrderItemDto {

  @ApiProperty({
    description: 'ID del item dentro de la orden (opcional).',
    example: 3,
    required: false,
  })
  id?: number;

  @ApiProperty({
    description: 'ID del producto.',
    example: 14,
  })
  productId: number;

  @ApiProperty({
    description: 'Lista de atributos actualizados.',
    type: [UpdateOrderItemAttributeDto],
    required: false,
  })
  attributes?: UpdateOrderItemAttributeDto[];

  @ApiProperty({
    description: 'Nota del producto.',
    example: 'Sin picante',
    required: false,
  })
  note?: string;
}

export class UpdateOrderItemsDto {

  @ApiProperty({
    description: 'Lista de items de la orden para reemplazar.',
    type: [UpdateOrderItemDto],
  })
  items: UpdateOrderItemDto[];
}

export class UpdateOrderGeneralDto {

  @ApiProperty({
    description: 'Nuevo nombre del cliente.',
    example: 'Juan López',
    required: false,
  })
  customerName?: string;

  @ApiProperty({
    description: 'Nuevo número telefónico.',
    example: '+57 302 555 1234',
    required: false,
  })
  phone?: string;

  @ApiProperty({
    description: 'Nueva dirección.',
    example: 'Carrera 15 #100-25, Bogotá',
    required: false,
  })
  address?: string;

  @ApiProperty({
    description: 'Nuevo tipo de la orden.',

    example:   "'delivery' | 'pickup' | 'table' | 'counter'",
    required: false,
  })
  orderType?: OrderType;

  @ApiProperty({
    description: 'Estado actual de la orden.',
    example: 'completed',
    required: false,
  })
  orderStatus?: OrderStatus;

  @ApiProperty({
    description: 'Indica si la orden ya fue impresa.',
    example: true,
    required: false,
  })
  printed?: boolean;
}
