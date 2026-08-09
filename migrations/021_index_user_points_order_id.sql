-- Acelera GET /orders/daily (lookup de códigos de puntos por orden).

CREATE INDEX idx_user_points_order_id ON ppp_user_points (order_id);
