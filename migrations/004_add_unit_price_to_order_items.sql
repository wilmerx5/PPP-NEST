-- Precio unitario en el momento del pedido (evita que órdenes históricas
-- se recalculen con precios actuales al cambiar productos en admin).
-- NULL = órdenes antiguas; se usa product.price como fallback.
ALTER TABLE ppp_order_items
ADD COLUMN IF NOT EXISTS unit_price DECIMAL(10,2) NULL;
