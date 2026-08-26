-- Domicilio por ruta (Google Directions) + tramos de tarifa
ALTER TABLE ppp_whatsapp_settings
  ADD COLUMN delivery_fee_mode VARCHAR(20) NOT NULL DEFAULT 'route_tiers',
  ADD COLUMN restaurant_lat DECIMAL(10, 7) NULL,
  ADD COLUMN restaurant_lng DECIMAL(10, 7) NULL,
  ADD COLUMN delivery_max_km DECIMAL(6, 2) NULL DEFAULT 5.50,
  ADD COLUMN delivery_fee_tiers JSON NULL;

UPDATE ppp_whatsapp_settings
SET
  restaurant_lat = 4.6323019,
  restaurant_lng = -74.1471957,
  restaurant_address = COALESCE(NULLIF(TRIM(restaurant_address), ''), 'Dg. 6b #78b-20, Bogotá'),
  restaurant_city = COALESCE(NULLIF(TRIM(restaurant_city), ''), 'Bogotá'),
  maps_url = COALESCE(
    NULLIF(TRIM(maps_url), ''),
    'https://www.google.com/maps/place/Dg.+6b+%2378b-20,+Bogot%C3%A1/@4.6323019,-74.1471957,17z'
  ),
  delivery_fee_mode = 'route_tiers',
  delivery_max_km = 5.50,
  delivery_fee_tiers = JSON_ARRAY(
    JSON_OBJECT('maxKm', 2.5, 'fee', 2000),
    JSON_OBJECT('maxKm', 3.5, 'fee', 5000),
    JSON_OBJECT('maxKm', 5.5, 'fee', 6000)
  )
WHERE id = 1;
