# Tanda 216 — referencias descriptivas y consulta con elección

Base `49cca892`, staging. Sin API pagada, Meta u órdenes externas. Modelos/Main intactos; sin despliegue.

## Cambios

Con varias presentaciones ofrecidas, referencias explícitas «el grande/pequeño/familiar/individual/mediano» se resuelven únicamente contra nombre terminado con esa etiqueta o descripción que declare presentación/tamaño/formato. No se infiere por precio ni por volumen de bebida. Normaliza género de pequeño/mediano. Ausencia/ambigüedad conserva pedido y pide número; disponibilidad y precio siguen revalidándose.

Pregunta reconocida terminada en signo de interrogación seguida de «dame/quiero el/la ...»: responde la consulta y procesa la elección explícita por la ruta existente. No repite el aviso de que falta elegir antes de aplicar la elección. Son dos respuestas en el mismo turno (detalle y resultado), no prueba de salida única. Si la elección no se reconoce, pide número y conserva carrito. No cubre todos los órdenes de cláusulas, conjunciones o preguntas mixtas libres.

## Evidencia

Baseline30/30 rojos (`/tmp/ppp-216-baseline.json`). Primera corrección18/30 verdes;12 fallos de aserción: el harness devolvía solo la última respuesta y omitía la primera que sí contestaba la pregunta. Corregido el oráculo para comprobar todas las salidas del turno desde su índice inicial; conserva las comprobaciones de respuesta/carrito/estado/DTO y no usa respuestas previas. Evidencia `/tmp/ppp-216-after.json` y snapshots por caso.

Ampliación60 conversaciones, tres menús×agente mock off/on×10 caminos: referencias grandes/pequeñas/familiares; consulta+elección; etiqueta ausente, acompañamiento grande que no define tamaño, dos etiquetas iguales, agotado, pregunta respondida con selección no identificable y precio cambiado que exige aceptación. Cierre simulado único con dos unidades, notas y bebida en DTO.

Foco246/246 en4 suites; TS general/build, Node92 yFalafel1 aprobados. Global final19.308/19.308 en282 suites,589 hashes sin cambios e inventario exacto,730,08s (`/tmp/ppp-216-final-global-summary.json`). Fuente congelada durante ambas particiones; sin omisiones/duplicados. No acredita inferencia real ni cobertura universal; no declarar vendible por conteos.

## Siguiente

Orden inverso de cláusulas (elección y luego consulta), preguntas con conjunción, referentes abreviados y cambio de bebida junto a presentación. Probar negativa/pregunta condicional sin compra, preservando datos de checkout. Primero foco, después global con fuente congelada. Agrupar despliegues.
