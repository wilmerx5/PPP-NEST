import { ApiProperty } from '@nestjs/swagger';
import { OrderSource, OrderStatus, OrderType } from "../entities/order.entity";
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOrderItemAttributeDto {

  @ApiProperty({
    description: 'Nombre del atributo seleccionable en el producto.',
    example: 'Salsa',
  })
  @IsString()
  attributeName: string;

  @ApiProperty({
    description: 'Valor seleccionado para el atributo.',
    example: 'BBQ',
  })
  @IsString()
  attributeValue: string;
}

export class AlsoDeductVariantDto {
  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  productId: number;

  @ApiProperty({ type: [CreateOrderItemAttributeDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemAttributeDto)
  attributes: CreateOrderItemAttributeDto[];
}

export class CreateOrderItemDto {

  @ApiProperty({
    description: 'ID del producto seleccionado.',
    example: 12,
  })
  @Type(() => Number)
  @IsNumber()
  productId: number;

  @ApiProperty({
    description: 'Nota opcional para el producto (picado, sin cebolla, etc).',
    example: 'Bien tostado',
    required: false,
  })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiProperty({
    description: 'Lista de atributos seleccionados para este producto.',
    required: false,
    type: [CreateOrderItemAttributeDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemAttributeDto)
  attributes?: CreateOrderItemAttributeDto[];

  /** Cuando este producto descontará de otro con variantes; indica de qué variante descontar (elegida al añadir). */
  @ApiProperty({
    description: 'Variante del producto asociado del que descontar (cuando aplica "también descontar de").',
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => AlsoDeductVariantDto)
  alsoDeductVariant?: AlsoDeductVariantDto;

  /** Precio unitario con descuento (solo ppp-orders-front). Si se envía, se guarda en la orden en lugar del precio del producto. Inventario se descuenta igual. */
  @ApiProperty({ description: 'Precio unitario con descuento (opcional).', required: false, example: 15000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice?: number;
}

export class CreateOrderExtraDto {
  @ApiProperty({ example: 'Plato extra' })
  @IsString()
  title: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 5000 })
  @Type(() => Number)
  @IsNumber()
  amount: number;

  @ApiProperty({ required: false, example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  quantity?: number;
}

export class CreateOrderDto {

  @ApiProperty({
    description: 'Nombre del cliente que realiza la orden.',
    example: 'Carlos Pérez',
  })
  @IsString()
  customerName: string;

  @ApiProperty({
    description: 'Teléfono del cliente.',
    example: '+57 300 456 7890',
  })
  @IsString()
  phone: string;

  @ApiProperty({
    description: 'Dirección del cliente.',
    example: 'Calle 123 #45-67, Bogotá',
  })
  @IsString()
  address: string;

  @ApiProperty({
    description: 'Email del cliente (solo lo asigna el backend desde el pago).',
    required: false,
  })
  @IsOptional()
  @IsString()
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
    enum: ['online', 'internal', 'whatsapp'],
    required: false,
  })
  @IsOptional()
  @IsEnum(['online', 'internal', 'whatsapp'])
  orderSource?: OrderSource;

  @ApiProperty({
    description: 'Lista de productos incluidos en la orden.',
    type: [CreateOrderItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];

  @ApiProperty({
    description: 'Adicionales o extras (código 90). Título, descripción opcional, monto, cantidad.',
    type: [CreateOrderExtraDto],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderExtraDto)
  extras?: CreateOrderExtraDto[];

  @ApiProperty({
    description: 'Código de premio de redención a aplicar (opcional).',
    example: 'REDEEM9PTSX7',
    required: false,
  })
  @IsOptional()
  @IsString()
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

  @ApiProperty({
    description: 'Latitud del domicilio (pedidos online con pin confirmado).',
    required: false,
    example: 4.6323,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  deliveryLat?: number;

  @ApiProperty({
    description: 'Longitud del domicilio (pedidos online con pin confirmado).',
    required: false,
    example: -74.1472,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  deliveryLng?: number;
}

export class DeliveryQuoteDto {
  @ApiProperty({
    description: 'Texto de la dirección (fallback si no hay pin).',
    required: false,
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ description: 'Latitud del pin confirmado.', required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lat?: number;

  @ApiProperty({ description: 'Longitud del pin confirmado.', required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lng?: number;
}

export class UpdateOrderItemAttributeDto {

  @ApiProperty({
    description: 'Nombre del atributo a modificar.',
    example: 'Bebida',
  })
  @IsString()
  attributeName: string;

  @ApiProperty({
    description: 'Nuevo valor del atributo.',
    example: 'Gaseosa',
  })
  @IsString()
  attributeValue: string;
}

export class UpdateOrderItemDto {

  @ApiProperty({
    description: 'ID del item dentro de la orden (opcional).',
    example: 3,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  id?: number;

  @ApiProperty({
    description: 'ID del producto.',
    example: 14,
  })
  @Type(() => Number)
  @IsNumber()
  productId: number;

  @ApiProperty({
    description: 'Lista de atributos actualizados.',
    type: [UpdateOrderItemAttributeDto],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateOrderItemAttributeDto)
  attributes?: UpdateOrderItemAttributeDto[];

  @ApiProperty({
    description: 'Nota del producto.',
    example: 'Sin picante',
    required: false,
  })
  @IsOptional()
  @IsString()
  note?: string;

  /** Si true, el ítem ya fue preparado por cocina (solo tiene sentido al añadir items a una orden ya en packing/cooked). */
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  kitchenPrepared?: boolean;

  /** Cuando este producto descontará de otro con variantes; indica de qué variante descontar. */
  @ApiProperty({ required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => AlsoDeductVariantDto)
  alsoDeductVariant?: AlsoDeductVariantDto;

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
  @Type(() => Number)
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
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateOrderItemDto)
  items: UpdateOrderItemDto[];

  @ApiProperty({
    description: 'Adicionales a agregar a la orden (código 90).',
    type: [CreateOrderExtraDto],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderExtraDto)
  extrasToAdd?: CreateOrderExtraDto[];

  @ApiProperty({
    description:
      'Cantidad de ítems (unidades) que el cliente vio en la orden ANTES de este cambio. Si no coincide con la DB, se rechaza (evita duplicar por caché stale / doble envío).',
    required: false,
    example: 3,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  baseItemCount?: number;
}

/** Delta: solo ítems NUEVOS a añadir (no reemplaza la orden). */
export class AppendOrderItemsDto {
  @ApiProperty({
    description: 'Ítems a añadir (una línea = una unidad). No enviar los que ya están en la orden.',
    type: [UpdateOrderItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateOrderItemDto)
  items: UpdateOrderItemDto[];

  @ApiProperty({
    description: 'Adicionales a agregar a la orden (código 90).',
    required: false,
    type: [CreateOrderExtraDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderExtraDto)
  extrasToAdd?: CreateOrderExtraDto[];
}

/** Delta: quitar unidades de un producto sin reenviar el resto de la orden. */
export class RemoveOrderItemsDto {
  @ApiProperty({ description: 'ID del producto a quitar.', example: 12 })
  @Type(() => Number)
  @IsNumber()
  productId: number;

  @ApiProperty({
    description:
      'Si se omite, quita TODAS las unidades de ese producto. Si se envía, quita solo la unidad N (0-based, orden por id ASC).',
    required: false,
    example: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitIndex?: number;
}

export class AddOrderExtraDto {
  @ApiProperty({ example: 'Plato extra', description: 'Título del adicional' })
  @IsString()
  title: string;
  @ApiProperty({ example: 'Para llevar', required: false })
  @IsOptional()
  @IsString()
  description?: string;
  @ApiProperty({ example: 5000 })
  @Type(() => Number)
  @IsNumber()
  amount: number;
  @ApiProperty({ example: 1, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  quantity?: number;
}

export class UpdateOrderExtraDto {
  @ApiProperty({ example: 'Plato extra', required: false })
  @IsOptional()
  @IsString()
  title?: string;
  @ApiProperty({ example: 'Para llevar', required: false })
  @IsOptional()
  @IsString()
  description?: string;
  @ApiProperty({ example: 5000, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  amount?: number;
  @ApiProperty({ example: 1, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  quantity?: number;
}

export class UpdateOrderGeneralDto {

  @ApiProperty({
    description: 'Nuevo nombre del cliente.',
    example: 'Juan López',
    required: false,
  })
  @IsOptional()
  @IsString()
  customerName?: string;

  @ApiProperty({
    description: 'Nuevo número telefónico.',
    example: '+57 302 555 1234',
    required: false,
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({
    description: 'Nueva dirección.',
    example: 'Carrera 15 #100-25, Bogotá',
    required: false,
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({
    description: 'Nuevo tipo de la orden.',
    example: "'delivery' | 'pickup' | 'table' | 'counter' | 'rappi'",
    enum: ['delivery', 'pickup', 'table', 'counter', 'rappi'],
    required: false,
  })
  @IsOptional()
  @IsEnum(['delivery', 'pickup', 'table', 'counter', 'rappi'])
  orderType?: OrderType;

  @ApiProperty({
    description: 'Estado actual de la orden.',
    example: 'completed',
    required: false,
  })
  @IsOptional()
  @IsString()
  orderStatus?: OrderStatus;

  @ApiProperty({
    description:
      'Si true, permite anular una orden ya completada (orderStatus=canceled). Restaura inventario.',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  forceCancel?: boolean;

  @ApiProperty({
    description: 'Indica si la orden ya fue impresa.',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
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
