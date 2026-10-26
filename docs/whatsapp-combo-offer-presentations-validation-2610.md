# Tanda 212 — presentaciones ambiguas de combos

Base `0f5cf0f1`, staging. Main/producción sin cambios.

## Cambio y contrato

Cuando un plato exacto tiene varias versiones de combo compatibles, la oferta inicial no designa una favorita. Conserva el plato base realmente pedido y muestra cada alternativa con código, precio y descripción para distinguir presentación/volumen. Guarda las opciones solicitadas por candidato en `pendingMatch.offeredAlternatives`. No compra el combo hasta elegir su fila; «sí» solo solicita aclaración, «no gracias» conserva el plato base.

La elección reutiliza las guardas de disponibilidad y precio del reemplazo. Conserva las opciones de la alternativa elegida al recotizar y permite cambiar a la otra presentación. Las opciones retiradas se vuelven a preguntar; no se aplica un sabor que ya no existe. Sin excepciones por nombre/ID/precio de restaurante. No se requiere migración de DB: campo opcional en JSON de sesión.

## Evidencia

Seis casos iniciales del diagnóstico210 fallan antes del ajuste (`/tmp/ppp-212-baseline.json`). Primera matriz24/24: elegir primera/segunda, rechazar y aclarar «sí», en tres menús×agente simulado off/on. Ampliación36/42: seis fallos al aceptar precio cambiado perdían bebida. Una iteración intermedia tuvo una condición incorrecta con valores undefined y una edición durante ejecución; `/tmp/ppp-212-final-repro.json` no es aprobación ni fuente estable. Corregida la guarda, repetición estable42/42 (`/tmp/ppp-212-stable-repro.json`).

Suite promovida `whatsapp-combo-offer-presentations.spec.ts`:48 conversaciones, añadiendo cambio a la otra presentación después de recotizar. Todas comprueban respuesta inicial, conservación/elección del carrito y48 cierres DTO simulados de dos unidades, con producto, preparación y nota. Foco final246/246 en6 suites (`/tmp/ppp-212-focus.json`). Diagnóstico210 completo36/36 aprobado; TS general/build, Node92 yFalafel1 también aprobados. Global final19.064 pruebas/277 suites aprobada,584 hashes,714,09s, inventario exacto y fuente congelada (`/tmp/ppp-212-final-global-summary.json`).

## Límites y siguiente bloque

La entrada sigue siendo compra explícita por nombre completo, carrito vacío y bebida solicitada; no acredita títulos abreviados, catálogos con nombres diferentes para el combo ni todos los volúmenes. La continuación probada selecciona filas numéricas; falta ampliar elección por código o descripción/volumen, preguntas sobre cada alternativa, negativa con compra aparte y datos de contacto durante esta nueva lista. No asumir esos casos por las guardas de oferta única.

Siguiente: reproducir esas interrupciones sin modificar el carrito por consulta. Revalidar disponibilidad/precio y notas de cada candidato. Probar también diferencias de opciones entre presentaciones, no solo de precio/volumen. Mantener los casos fuera de alcance como pendientes explícitos.

Pruebas gratuitas con agentes/servicios simulados; sin API pagada, Meta ni órdenes externas. Sin cambio de modelos ni medición nueva de ahorro. Agrupar despliegue de staging; esta tanda no incluye promoción a Main. No declarar vendible por conteos.
