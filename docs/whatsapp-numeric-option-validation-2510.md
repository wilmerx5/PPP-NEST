# Tanda197 — espacios dentro de opciones numéricas del catálogo

Base73e23ab2, staging, 25/10. Se separaron dos problemas: «7 up» puede aportar7como cantidad o perder el sabor; incluso «7up» unido puede separar arroz y pollo en lugar de elegir el combo.

## Cambio limitado

Normaliza un token de opción numérico/alfabético del catálogo cuando aparece separado por espacios. Ejemplos de pruebas:7up,3fresh,9cool. No fija marcas en runtime ni convierte números de productos, calles o volúmenes en cantidades nuevas. Solo reconoce tokens que ya existen en opciones; conserva cantidades que preceden al plato. Litros/gramos/volúmenes quedan excluidos.

## Evidencia

- Diagnóstico opt-in12casos: mensaje original, combo explícito singular y plural; cada uno7upunido/separado y agente mock off/on. Baseline2verdes/10rojos; después4verdes/8rojos. `whatsapp-numeric-drink.repro.ts`, /tmp/ppp-197-baseline.json y /tmp/ppp-197-after.json.
- Original sin «combo»: ya no agrega7medios pollos, pero sigue arroz1+medio pollo1; pluralcombo sigue separación incorrecta. NO afirmar solucionado el pedido completo.
-21regresiones nuevas:3menús/opciones numéricas, cantidades1/2/3 en normalización, controles calle/volumen/cantidad real/opción ausente, router off/on y ejemploPPPcombo singular. Ocho recorridos verifican producto/cantidad/atributos del DTO simulado.
- TypeScript general/build y Node92aprobados. Foco21/21. Global: 18.648 pruebas / 263 suites, 567 hashes, 891,04 s; inventario exacto y fuente congelada. Evidencia /tmp/ppp-197-global-summary.json.
- Cero inferencia pagada/Meta/órdenes externas. Modelos simulados no acreditan precisión real. Sin deploy ni Main.

## Solicitudes adicionales durante la global

Ampliación ejecutada DESPUÉS de la global: 20/20 casos nuevos en whatsapp-redundant-notes-expanded.repro.ts (opt-in), con arroz, plátanos y dos menús ficticios; 16 cierres DTO sintéticos con/sin nota real y 4 controles PPP. Evidencia /tmp/ppp-197-notes-final.json. Inicialmente 18/20: el arroz PPP pedía elegir una única presentación; al completar selección y preparación se verifica ausencia de nota redundante. Esa selección adicional sigue siendo fricción pendiente, no una mejora runtime de esta tanda. No se alteró runtime tras la global. Cobertura191 previa no se cuenta como nueva.

Costo observado por el usuario:recarga10USD,saldo8,82USD,delta1,18USD. Auditoría solo lectura25/10: cinco429credit_balance_exhausted en producción15:11:10–15:22:26 Bogotá, último mensaje técnico15:22:28, primer turnoagentposterior15:30:29. Consulta desde15:22:29 hastaúltimo mensaje21:23:44:189entrantes(187texto,2ubicación),6conversaciones,19órdenes fuenteWhatsApp y19recibos en4conversaciones;68órdenes internas excluidas. Logs45turnosagent_v1 en4conversaciones, no equivale45HTTP. Sin audio/imagen en esa ventana. StagingnoeventosWaTurnTelemetry observados en logs de esa ventana; no prueba facturación exclusiva. Delta/19≈0,062USD es promedio provisional, no costo medido por orden: hora exacta de recarga y desglose del proveedor no disponibles. No clasificar las19como clientes reales ni distinguir pruebas sin etiqueta. Telemetría productiva actual no registra tokens/costo por pedido; BetaApiUsagees paraensayos. Siguienteinstrumentación:tokensentrada/salida/cache,modelo,númerollamadas,modalidad y vínculo a conversación/orden, sin guardar secretos ni contenido. Conciliar con Costs oficial antes de cambiar modelos por costo.
