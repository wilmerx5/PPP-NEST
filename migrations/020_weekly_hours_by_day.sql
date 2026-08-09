-- Horario distinto por dia de la semana (LONGTEXT JSON). Una sola sentencia.

ALTER TABLE ppp_restaurant_settings
  ADD COLUMN weekly_hours LONGTEXT NULL;
