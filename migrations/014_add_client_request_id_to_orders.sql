-- Idempotencia de creación de órdenes (reintentos / timeouts / webhook MP).
-- client_request_id UNIQUE: el mismo UUID/clave no crea una segunda orden.

ALTER TABLE ppp_orders
ADD COLUMN client_request_id VARCHAR(64) NULL DEFAULT NULL
  COMMENT 'Clave de idempotencia del cliente (UUID o mp-pay-{id})';

CREATE UNIQUE INDEX uq_ppp_orders_client_request_id
  ON ppp_orders (client_request_id);
