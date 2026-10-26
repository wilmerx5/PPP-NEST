# Tanda 189 — referencias de entrega sin perder el cierre

Base817395e7, solo staging. Corrige los primeros fallos reproducidos de auditoría188. No cierra todos los defectos de los chats nuevos.

## Cambio

- Si el cliente pide enviar una referencia para un pin ya guardado, se pregunta por el nombre del lugar/referencia. Se conserva el estado de pago/confirmación; no se confirma la orden.
- Una referencia nominal recibida en esa espera se añade junto al enlace original. También se reconocen nombres con indicadores generales de establecimiento (hotel, edificio, rooftop, etc.) sin solicitud previa. No hay nombres de lugares, productos o IDs específicos en la regla.
- Conserva coordenadas y tarifa. Repetir la referencia no la duplica. La espera queda vinculada a la dirección actual: no se aplica al cambiar el destino. Si el texto no es una referencia segura se permite el flujo habitual de consulta, pago, contacto, compra, calle nueva o cancelación.
- Con dirección ya capturada mientras se pide nombre, se reconoce lo anotado y se pide el nombre. Si era una referencia sin calle, se conserva para completar la calle posterior. No se afirma que esté localizada en el mapa ni se inventan coordenadas.
- Se mantiene el límite de longitud de dirección; no se corta el enlace original para encajar una referencia larga.

## Pruebas

Los8diagnósticos de188 se promueven a whatsapp-new-chats-2510.spec.ts tras pasar. Inicialmente188:6rojos/2verdes; con corrección:8/8. Cubre portería antes del nombre y calle, solicitud de referencia durante confirmación, referencia directa tras pin y consulta de total. El total ya pasaba, no atribuirlo a esta corrección.

whatsapp-pinned-reference-checkout.spec.ts:42casos nuevos:
-24recorridos:3menús sintéticos × agente simulado off/on × pago/confirmación × referencia directa/solicitada. Repetición y cierre DTO verifican2unidades/notas, pin y referencia, tarifa5000 y ninguna orden antes de confirmar.
-8interrupciones:total, pago, nombre explícito y teléfono durante espera, conservando dirección y permitiendo completar referencia después.
-4controles:calle nueva y reinicio, off/on. No conservar pin viejo como destino ni crear órdenes.
-6recorridos:portería antes de nombre y calle,3menús×off/on, hasta DTO con referencia, calle y nombre correctos.

Foco inicial52/52en3suites; ampliación final42/42de la matriz (incluye6casos nuevos). TypeScript general/build finales yNode92/92aprobados. Global final:18.459/257suites,557hashes,776,07segundos, inventario exacto/fuente congelada. Evidencia /tmp/ppp-189-global-summary.json, /tmp/ppp-189-hashes.json, /tmp/ppp-189-{burst,rest}.json.

## Límites y pendientes

Mapas, modelo, persistencia, Meta y órdenes simulados. Cero API pagada ni WhatsApp/órdenes externas. No acredita precisión de geocodificación real ni inferencia real. No se hicieron cambios en Main ni despliegues.

La regla exige referencia nominal breve; no pretende aceptar cualquier frase como dirección. No se resuelve aquí una referencia muy larga, varios destinos ambiguos o referencias mezcladas con compra/preguntas en la misma frase. El vínculo con dirección evita reutilizar una espera de otro destino.

Pendiente del chat:reproducir «o sea1y1», compra de2pollos con acompañamientos repartidos, nota residual, origen de nombre«Es» y cambio«Efectivo50». Mantener pendientes183/184/186. No presentar este cierre como solución de todos los chats.

Inspección para la tanda siguiente: `isUsableWhatsappCustomerName` en whatsapp-session-intents.ts acepta actualmente «Es» (no aparece en exclusiones y satisface longitud). Esto explica que pueda conservarse si llega a persistencia, no prueba cómo se extrajo en producción. Reproducir desde nombre vacío y desde nombre previo antes de cambiar extracción; conservar nombres cortos legítimos.
