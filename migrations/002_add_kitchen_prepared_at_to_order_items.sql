-- Items pendientes de cocina: kitchen_prepared_at IS NULL
-- Cuando cocina marca orden como lista/empacando se actualiza a now()
ALTER TABLE ppp_order_items
ADD COLUMN IF NOT EXISTS kitchen_prepared_at TIMESTAMP NULL;
