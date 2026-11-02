# Tanda356 — datos de transferencia en revisión final

Origen: chat anonimizado del02/11, combo de arroz, medio pollo, consulta de datáfono y elección anticipada de transferencia. El usuario aclara que la mención inicial de pollo frito no es un fallo que corregir en este caso.

Reproducido:20/20 casos iniciales omiten datos configurados o aviso de cuenta ausente al revisar el pedido; incluye cambio desde efectivo. La elección temprana salta el paso awaiting_payment, donde se enviaban las instrucciones. La revisión final ahora muestra los datos del comercio; evita repetirlos si ya están en el prefacio de ese mismo turno. Cambio directo desde efectivo también los muestra. Cuenta ausente produce aviso explícito, sin inventar datos ni prometer enviarlos automáticamente.

28 controles:16 recorridos de elección anticipada y cierre simulado,4 cambios desde efectivo,8 controles de elección normal sin duplicar cuentas ni mostrar instrucciones de transferencia al elegir efectivo. Dos catálogos y agente desactivado/simulado. Carrito, estado, confirmación explícita y pago en DTO verificados. El DTO existente guarda el medio de pago en address; la prueba se ajustó a ese contrato.

Validación:28/28 controles nuevos aprobados;124 controles existentes de3 suites relacionadas aprobados. Global33991/424 aprobada, sin omisiones, inventario exacto y642 fuentes sin cambios; TypeScript general/build y scripts aprobados. Staging desplegado/verificado en `b648c6e1`, workflow41522483566: healthy, cero reinicios, API local/pública ok, configuración/modelos preservados. Controles compilados previos aprobados; cobertura356 local. Producción sin cambios. Sin llamadas pagadas, Meta ni órdenes externas.

Límites: no confirma que un cliente haya transferido, no cambia validación de comprobantes ni configura cuentas reales. No acredita canal/modelo real. No cambia órdenes históricas.

Siguiente: preguntas de capacidad de pago («manejan datáfono»): falta «manejan» en el detector y hay afirmaciones rígidas sobre datáfono que deben distinguir equipo físico de enlace, usando configuración real. No asumir que Mercado Pago habilitado implica disponibilidad o ausencia de datáfono. Después retomar sustituciones durante aclaración de notas.
