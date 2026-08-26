-- Domicilio web (checkout ppp-front): tramos por km de ruta
ALTER TABLE ppp_restaurant_settings
  ADD COLUMN IF NOT EXISTS web_delivery_default_fee INT NOT NULL DEFAULT 4000,
  ADD COLUMN IF NOT EXISTS web_delivery_max_km DECIMAL(6,2) NULL DEFAULT 6.00,
  ADD COLUMN IF NOT EXISTS web_delivery_fee_tiers JSON NULL;

UPDATE ppp_restaurant_settings
SET
  web_delivery_default_fee = COALESCE(web_delivery_default_fee, 4000),
  web_delivery_max_km = COALESCE(web_delivery_max_km, 6.00),
  web_delivery_fee_tiers = COALESCE(
    web_delivery_fee_tiers,
    JSON_ARRAY(
      JSON_OBJECT('maxKm', 4, 'fee', 4000),
      JSON_OBJECT('maxKm', 6, 'fee', 6000)
    )
  )
WHERE id = 1;
