# Tanda 110 — selección numérica del combo

Base c06fec97. Motivación: chat real con selección de combo y bebida que terminó mostrando la bebida anterior; pendiente explícito de tanda 104. Regresiones con tres menús sintéticos y agente simulado habilitado/deshabilitado.

## Cambio general

tryAnswerComboSwapOffer acepta números simples únicamente si existe oferta de reemplazo con preferredId y la fila corresponde a candidato ofrecido. El número identifica combo, nunca cantidad ni bebida. Conserva opciones compatibles del plato, cantidad y nota. Mantiene plato original mientras faltan opciones y reemplaza al terminar. Precio diferente al ofrecido pasa por re-cotización antes de aceptar; no se salta la confirmación del nuevo valor.

## Pruebas

30 casos nuevos añadidos a la suite existente (36 previos → 66): 12 recorridos eligen combo propio u otro, eligen bebida por número y llegan al DTO; seis conservan dos unidades/nota; seis verifican precio cambiado y aceptación; seis rechazan números no ofrecidos. Diferente orden de atributos entre arroz, hamburguesa y salchipapa. Las opciones conservadas son pollo, término o salsa, no reglas específicas de PPP.

Baseline inicial 12 fallidos/42 verdes en 54 casos. Luego 12 contrastes adicionales; 66/66 finales. Focalizadas 479/479, 7 suites, 51,520 s, incluyendo aceptación de precio, cambios de contacto y selección numérica/cancelación existentes. TypeScript general/build, 92 contratos Node y diff --check aprobados.

Global congelada: ráfagas 80/80 (113,515 s); resto 15.897/15.897 en 191 suites (441,597 s). Total 15.977, 192 suites, 556,93 s de orquestación, 490 hashes sin cambio, unión exacta del inventario; cero reintentos.

Logs locales /tmp/ppp-110-baseline.log, /tmp/ppp-110-expanded.log, /tmp/ppp-110-targets.log, /tmp/ppp-110-tsc.log, /tmp/ppp-110-build.log, /tmp/ppp-110-node.log, /tmp/ppp-110-burst.json, /tmp/ppp-110-rest.json, /tmp/ppp-110-global-summary.json. Este documento conserva el resultado aunque /tmp desaparezca.

## Límites

No acredita interpretación del modelo real ni todas las paráfrasis numéricas. No cambia ofertas sin preferredId ni compra inicial con pregunta de contenido. Los precios y catálogos son simulados; no se llamó API pagada, Meta, mapas reales ni se crearon órdenes externas. Main y producción se mantienen en tandas hasta 109; continuar integración en staging.
