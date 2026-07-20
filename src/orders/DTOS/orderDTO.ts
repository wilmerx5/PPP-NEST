import { ApiProperty } from '@nestjs/swagger';
import { OrderSource, OrderStatus, OrderType } from "../entities/order.entity";
import { IsArray, IsEnum, IsNumber, IsOptional, IsString, Min, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';

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

  /** Cuando este producto descontará de otro con variantes; indica de qué variante descontar (elegida al añadir). */
  @ApiProperty({
    description: 'Variante del producto asociado del que descontar (cuando aplica "también descontar de").',
    required: false,
  })
  @IsOptional()
  alsoDeductVariant?: {
    productId: number;
    attributes: { attributeName: string; attributeValue: string }[];
  };

  /** Precio unitario con descuento (solo ppp-orders-front). Si se envía, se guarda en la orden en lugar del precio del producto. Inventario se descuenta igual. */
  @ApiProperty({ description: 'Precio unitario con descuento (opcional).', required: false, example: 15000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice?: number;
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
    description: 'Email del cliente (solo lo asigna el backend desde el pago).',
    required: false,
  })
  @IsOptional()
  customerEmail?: string;

  @ApiProperty({
    description: 'Tipo de orden.',
    example: 'delivery',
    enum: ['delivery', 'pickup', 'table', 'counter', 'rappi'],
    required: false,
  })
  @IsOptional()
  @IsEnum(['delivery', 'pickup', 'table', 'counter', 'rappi'])
  orderType?: OrderType;

  @ApiProperty({
    description: 'Costo del servicio de delivery (solo requerido si orderType = delivery).',
    example: 5000,
    required: false,
  })
  @ValidateIf((o) => o.orderType === 'delivery')
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  deliveryFee?: number;

  @ApiProperty({
    description: 'Origen: online = cliente/ppp-front; internal = panel. No enviar = internal.',
    enum: ['online', 'internal'],
    required: false,
  })
  @IsOptional()
  @IsEnum(['online', 'internal'])
  orderSource?: OrderSource;

  @ApiProperty({
    description: 'Lista de productos incluidos en la orden.',
    type: [CreateOrderItemDto],
  })
  items: CreateOrderItemDto[];

  @ApiProperty({
    description: 'Adicionales o extras (código 90). Título, descripción opcional, monto, cantidad.',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        title: { type: 'string', example: 'Plato extra' },
        description: { type: 'string', example: 'Para llevar', nullable: true },
        amount: { type: 'number', example: 5000 },
        quantity: { type: 'number', example: 1, default: 1 },
      },
      required: ['title', 'amount'],
    },
    required: false,
  })
  @IsOptional()
  extras?: { title: string; description?: string; amount: number; quantity?: number }[];

  @ApiProperty({
    description: 'Código de premio de redención a aplicar (opcional).',
    example: 'REDEEM9PTSX7',
    required: false,
  })
  @IsOptional()
  redemptionCode?: string;

  @ApiProperty({
    description:
      'Clave única por intento de envío (UUID). Si se reenvía la misma clave, se devuelve la orden ya creada. También se acepta header Idempotency-Key.',
    required: false,
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsOptional()
  @IsString()
  clientRequestId?: string;
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

  /** Si true, el ítem ya fue preparado por cocina (solo tiene sentido al añadir items a una orden ya en packing/cooked). */
  @ApiProperty({ required: false })
  @IsOptional()
  kitchenPrepared?: boolean;

  /** Cuando este producto descontará de otro con variantes; indica de qué variante descontar. */
  @ApiProperty({ required: false })
  @IsOptional()
  alsoDeductVariant?: {
    productId: number;
    attributes: { attributeName: string; attributeValue: string }[];
  };

  /** Precio unitario con descuento (solo ppp-orders-front). Si se envía, se usa en lugar del precio del producto. */
  @ApiProperty({ required: false, example: 15000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice?: number;
}

export class UpdateOrderItemUnitPriceDto {
  @ApiProperty({ description: 'ID del producto al que aplicar el precio unitario.' })
  @IsNumber()
  productId: number;

  @ApiProperty({ description: 'Precio unitario a aplicar (descuento o precio fijo).' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  unitPrice: number;
}

export class UpdateOrderItemsDto {

  @ApiProperty({
    description: 'Lista de items de la orden para reemplazar.',
    type: [UpdateOrderItemDto],
  })
  items: UpdateOrderItemDto[];

  @ApiProperty({
    description: 'Adicionales a agregar a la orden (código 90).',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string', nullable: true },
        amount: { type: 'number' },
        quantity: { type: 'number', default: 1 },
      },
      required: ['title', 'amount'],
    },
    required: false,
  })
  @IsOptional()
  extrasToAdd?: { title: string; description?: string; amount: number; quantity?: number }[];
}

export class AddOrderExtraDto {
  @ApiProperty({ example: 'Plato extra', description: 'Título del adicional' })
  title: string;
  @ApiProperty({ example: 'Para llevar', required: false })
  @IsOptional()
  description?: string;
  @ApiProperty({ example: 5000 })
  amount: number;
  @ApiProperty({ example: 1, required: false })
  @IsOptional()
  quantity?: number;
}

export class UpdateOrderExtraDto {
  @ApiProperty({ example: 'Plato extra', required: false })
  @IsOptional()
  title?: string;
  @ApiProperty({ example: 'Para llevar', required: false })
  @IsOptional()
  description?: string;
  @ApiProperty({ example: 5000, required: false })
  @IsOptional()
  amount?: number;
  @ApiProperty({ example: 1, required: false })
  @IsOptional()
  quantity?: number;
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
    example: "'delivery' | 'pickup' | 'table' | 'counter' | 'rappi'",
    enum: ['delivery', 'pickup', 'table', 'counter', 'rappi'],
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

    @ValidateIf((o) => o.orderType === 'delivery')
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  deliveryFee?: number;
}

export class ChangeTableDto {
  @ApiProperty({
    description: 'Número o identificador de la mesa destino.',
    example: '7',
  })
  @IsString()
  newTable: string;
}

export class LinkTablesDto {
  @ApiProperty({
    description: 'Números de mesa a vincular con la orden actual (deben tener orden activa hoy).',
    example: ['4', '7'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  tableNumbers: string[];
}
