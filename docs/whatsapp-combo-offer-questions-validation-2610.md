# Tanda 211 — consultas durante una oferta de combo

Base `a71730d7`, staging. Sin despliegue ni promoción a Main en esta tanda.

## Fallos y cambios

36 consultas de precio/sabores fallaban en tres menús sintéticos, con agente simulado apagado y encendido. Precio respondía desde el plato base y sabores abría variantes de producto. Ahora las consultas explícitas sobre el combo pendiente consultan su candidato en la carta vigente, responden y conservan la propuesta y el carrito. Se pregunta si desea cambiar al combo; la consulta sola no compra ni modifica cantidad/notas.

La ampliación reveló6 fallos adicionales: al aceptar una nueva cotización se sustituía Pepsi por la bebida predeterminada. La aceptación de precio para una propuesta con opciones guardadas reutiliza la ruta de reemplazo que conserva/revalida esas opciones. No se acepta el nuevo precio solo por consultarlo: se mantiene la cotización pendiente y la confirmación posterior.

Sin nombres/IDs/precios de restaurantes en runtime. Alcance acotado a una propuesta con candidato único y consultas explícitas de precio o sabores del combo. No cubre todas las formulaciones, preguntas compuestas con compras ni varias presentaciones ambiguas.

## Pruebas y evidencia

Nueva `whatsapp-combo-offer-questions.spec.ts`:54 casos, tres menús×agente simulado off/on. Incluye36 consultas con/sin puntuación/cortesía,6 cambios de precio,6 cambios de sabores y6 combos agotados. Los48 casos con compra posterior cierran DTO simulado conservando dos unidades, producto, preparación y nota; los6 agotados conservan carrito incluso tras intentar aceptar. No equiparar mocks con inferencia real.

Baseline36/36 fallidos: `/tmp/ppp-211-baseline.json`. Primer ajuste36/36 aprobados: `/tmp/ppp-211-after.json`. Ampliación42/48: `/tmp/ppp-211-expanded.json`; después de reparar aceptación48/48: `/tmp/ppp-211-expanded-final.json`. Foco final198/198 en5 suites: `/tmp/ppp-211-focus.json`. TypeScript general/build final sin errores; Node92/92. Falafel1/1 aprobado. Global final19.016 pruebas/276 suites aprobada;583 hashes,709,91s, inventario exacto y fuente congelada (`/tmp/ppp-211-final-global-summary.json`). Diagnóstico210 repetido:30/36 aprobados; solo fallan los6 de presentaciones ambiguas (`/tmp/ppp-211-diagnostic.json`).

## Continuación

Revisar el diagnóstico210 completo y mantener abiertos los casos que aún fallan. Próxima prioridad: dos combos de igual nombre con distintas presentaciones; ofrecer opciones diferenciables por descripción/volumen, sin elegir por el usuario ni perder notas. Después ampliar nombres abreviados, consultas sin sujeto y preguntas combinadas con cambios. Mantener respuesta, carrito, estado y DTO como oráculos, junto con precio/disponibilidad vigentes.

Cero llamadas pagadas, Meta u órdenes externas; sin cambios de modelos ni cifras de ahorro inventadas. Main/producción conservan código209. Agrupar despliegue de staging con tandas siguientes. No declarar vendible por conteos.
