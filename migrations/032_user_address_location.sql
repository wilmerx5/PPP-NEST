-- Pin de mapa para direcciones guardadas del usuario (confirmación una sola vez)
ALTER TABLE ppp_user_addresses
  ADD COLUMN lat DECIMAL(10, 7) NULL,
  ADD COLUMN lng DECIMAL(10, 7) NULL,
  ADD COLUMN location_confirmed TINYINT(1) NOT NULL DEFAULT 0;
