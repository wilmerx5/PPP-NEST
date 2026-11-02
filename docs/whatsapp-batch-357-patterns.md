# Tanda357 — consulta de datáfono sin cambiar el pedido

Origen: consulta «Manejan datáfono?» del chat02/11 aportado por el usuario. Derivaciones: tarjeta, verbo reciben, consulta corta, preguntas durante nombre/dirección/teléfono/pago/revisión, método presencial configurado y pago por enlace habilitado o ausente.

Baseline:60/64 controles fallan. «Manejan datáfono» podía interpretarse como búsqueda de productos; la consulta de tarjeta podía responder por el método ya seleccionado. El manejador tardío también afirmaba ausencia de datáfono sin evidencia y descartaba ofertas pendientes.

Cambio: reconoce maneja/manejan, recibe/reciben y «¿Datáfono?». Una consulta completa y aislada se responde antes de consumir el campo pendiente; no intercepta órdenes mixtas ni elecciones de pago. Responde con métodos habilitados y condiciones configuradas, distingue enlace de datáfono físico y reconoce falta de información cuando no hay método presencial explícito. Conserva carrito, pago, estado y oferta pendiente; retoma el paso pendiente mediante recordatorio existente. No crea configuración real ni habilita Mercado Pago.

73 controles nuevos:48 consultas en6 estados ×2 textos ×2 modos de agente ×MP habilitado/ausente;4 métodos presenciales configurados;4 ofertas pendientes;8 controles de detector;5 límites para mensajes mixtos;4 recorridos consulta→elección real→confirmación con DTO simulado. Usa dos catálogos, agente off/mock. Foco164/3 aprobado (64 iniciales+100 existentes); final73/1 aprobado. La prueba de mensajes mixtos verifica el límite de intercepción temprana, no acredita resolver cada intención del mensaje combinado.

Primera global interrumpida al detectar4 fallos existentes de claridad: la respuesta de efectivo ya no explicaba que la consulta no selecciona ese método. Se restauró la aclaración;4/4 controles afectados y73/73 nuevos aprobaron. Código final131b2c33, sobre4c58f6d1. Repetición global34064/425 aprobada, sin omisiones; inventario exacto y643 fuentes sin cambios. TypeScript general/build y scripts aprobados. Despliegue pendiente. Sin inferencia pagada, Meta ni órdenes externas. No acredita modelo/canal real ni disponibilidad real de datáfono; el comercio debe mantener sus métodos/condiciones configurados.

Próximo: retomar sustitución de producto/preparación durante aclaración de nota (tanda355), conservando identidad y evitando aplicar una selección vieja sobre carrito cambiado.
