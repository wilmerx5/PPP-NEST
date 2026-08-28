-- Config impuestos FE en admin (por restaurante / SaaS)
ALTER TABLE ppp_restaurant_settings
  ADD COLUMN IF NOT EXISTS factus_item_taxes JSON NULL,
  ADD COLUMN IF NOT EXISTS factus_prices_include_tax TINYINT(1) NULL;
