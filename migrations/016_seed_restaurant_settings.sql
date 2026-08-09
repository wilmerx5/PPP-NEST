-- 2/5 fila default (Colombia, sin dias cerrados).

INSERT INTO ppp_restaurant_settings (id, timezone, weekly_closed_days, open_time, close_time)
SELECT 1, 'America/Bogota', '[]', '11:00', '22:00'
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM ppp_restaurant_settings WHERE id = 1
);
