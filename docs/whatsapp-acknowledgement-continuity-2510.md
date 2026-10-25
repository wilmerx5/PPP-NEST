# Tanda 172 — notas, confirmaciones sin siguiente paso y saludo

Base33aee94e, rama staging; usuario25/10/2026. Main/producción hasta171 se preservan.

## Evidencia y correcciones

Los chats muestran tres capas: solicitud de condimento que provoca aclaración innecesaria, respuesta del agente que afirma guardar un dato sin orientar el siguiente paso y dirección registrada pero no localizada. No atribuir al modelo toda la causa ni afirmar que anotada equivale a validada.

Baseline /tmp/ppp-172-baseline.log:15/15 falló. Interpretación de nota no admitía plural «artos sobres»; seguimiento se podía clasificar como dirección. «Cr» no entraba consistentemente a la ruta de calle completa. La conservación de interiores solo admitía nombres con prefijos conjunto/condominio/etc. Se añade normalización acotada de Cr numerada, notas de sobres con adjetivo de cantidad (no compra numérica), plural en preferencias ancladas y conservación de dirección previa no localizada con detalles internos. No hardcodes de nombres de restaurantes, platos o conjuntos.

Agente: setAddress con carrito pasa por checkout para cotizar/validar y preguntar lo faltante; no se entrega solo la afirmación del modelo. Notas/ediciones con respuesta sin pregunta añaden el pendiente real o «¿Algo más?». Saludo: se elimina solo «Aún estoy aprendiendo y a veces cometo errores», tanto del valor por defecto como de copia antigua almacenada; se conserva atención y teléfono.

## Pruebas y límites

35 casos nuevos en whatsapp-acknowledgement-continuity.spec.ts y1 contrato de saludo. Tres menús, tres condimentos, compra inicial con agente mock on/off y seguimiento con acciones simuladas update_item. Verifican nota, cantidad, no selección adicional, ausencia de interpretación como dirección y continuidad. Los positivos completan pago/confirmación y DTO de una unidad con nota. Direcciones: calle abreviada tras lugar+torre/apartamento; mapa exitoso avanza a pago y DTO conserva interior; mapa ambiguo pide ubicación y no alcanza confirmación. Dos contratos llaman directamente tryHandleAgentV1 para aislar la rama de setAddress, con guard/carrito/checkout reales y proveedor/routing simulado; no acreditan todo el enrutamiento para esa rama.

Foco aprobado52/52,3suites,15,08s: /tmp/ppp-172-focus-approved.log. Un intento anterior incluyó por error un nombre de suite inexistente (whatsapp-product-intent.spec.ts);52 pruebas pasaron pero el comando falló, no se cuenta como validación aprobada. Corregido comando y repetido.

En el fixture inicial de dirección positiva el mapa aceptaba también el nombre del conjunto; se corrigió para simular ambigüedad inicial y éxito solo tras la calle. La primera ampliación del cierre negativo descubrió otro camino pendiente: repetir calle sin interiores después de ambigüedad puede perder el apartamento y terminar anexando «Contraentrega» a la dirección. Evidencia /tmp/ppp-172-focus3.log. Los negativos actuales se detienen en la solicitud de ubicación; NO acreditar ese cierre como resuelto. Próxima prioridad: recuperación con ubicación real y repetición de misma calle, interiores conservados, pago jamás anexado como dirección.

No se reproduce Maps real ni precisión del modelo. No se garantiza que Cr78B#6B-75 ubique físicamente el conjunto correcto. Sin llamadas pagadas, WhatsApp ni órdenes externas. No ampliar disponibilidad de condimentos ni prometer extras gratis: se anotan preferencias, no productos adicionales.

Global18.085/18.085,241suites,539hashes,801,75s; inventario exacto/fuente congelada. TypeScript general/build OK; Node92/92. Evidencia /tmp/ppp-172-{global-summary.json,tsc.log,node.log}. Publicación y despliegue agrupado170–172 completados solo en staging. Verificado25/10/2026 13:33UTC: HEAD13261a986ca025701ecb404fcc527501003763e6; imagen71c74937deb0aa903be414962903cf9143db8a1e24db41917d090bfae20cfbcb, healthy/0reinicios; API públicaOK, DBconnected, circuitCLOSED. Flags PPP_STAGING=true, WHATSAPP_STAGING_PUBLIC_CHAT=true, STAGING_ORDER_EVENTS_ALLOW=false. .env.staging conservado por hash. Rollback ppp-nest-staging:rollback-before-13261a98. Producción conserva imagen43a0d14fbecf2bd0e477911426cc249e798ec8d2afa62f57125b8e0702a3392b, running/0reinicios; Main intacta. Logs /tmp/ppp-172-deploy.log y /tmp/ppp-172-verified.log.
