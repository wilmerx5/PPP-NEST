# Tanda 174 — pin después de dirección ambigua

Basec4ffc6f9, solo staging. No cambia runtime: verifica la recuperación ya existente y añade protección de regresión.

36 casos: tres menús × agente simulado on/off × pin nativo/enlace Maps/pin con destino nuevo × dentro/fuera de cobertura. Todos pasaron en baseline (11,014s). No presentar esta tanda como36 fallos corregidos.

Se recorre el router con carrito sembrado de2 unidades, nota y destinatario conocido. Tras geocodificación ambigua se envía ubicación: pin sin nombre y enlace preservan conjunto/torre/apto; pin con nuevo nombre/dirección no arrastra el destino anterior. Se verifican carrito, nombre, coordenadas, respuesta, tarifa y estado. Los18 positivos avanzan a pago/confirmación y DTO simulado con2 entradas y nota; los18 negativos verifican que confirmar fuera de cobertura no crea orden. El destinatario está sembrado: no acredita extracción del nombre en este mismo recorrido.

Mapas y modelos simulados, sin API/Meta/órdenes externas. No verifica geocodificación real, OCR de direcciones ni precisión del modelo. Pin rotulado con el mismo conjunto (en lugar de pin sin nombre) queda como variante pendiente: no confundir con el control de destino nuevo.

Foco113/113,4suites,20,301s; TypeScript general/build OK; Node92/92. Logs /tmp/ppp-174-{baseline,focus,tsc,node}.log. No repetir global solo por pruebas/documentación: runtime permanece exactamente igual al validado en173 (18.109/242suites); estos36 casos son evidencia adicional, no un nuevo conteo global ejecutado.

Siguiente: preguntas múltiples al resolver dirección y nombre antes/después del pin; pins rotulados con el mismo conjunto sin perder interiores, diferenciando destino nuevo.
