> Actualización del 17/10: el estado del 16/10 de este documento es histórico. Leer primero el cierre vigente en [relevo local](WHATSAPP-LOCAL-NEXT-AGENT.md): código 0f98eb1e, 77 suites/7259 pruebas aprobadas sobre fuente congelada; audio/sabores y carta ya abordados. Siguiente puerta: validación independiente del modelo y canal antes del piloto.

# Plan de continuidad: PPP WhatsApp hasta piloto

Fecha: 16 de octubre de 2026, Bogotá. Documento de trabajo para otro agente local.

## 1. Objetivo y alcance

Convertir el asistente de pedidos en un producto confiable para un piloto supervisado de PPP, y conservar una base reutilizable en Kamppo multitenant. Prioridad actual: comprensión, contexto, acciones correctas y respuestas coherentes. El usuario ha pedido pruebas exhaustivas con chats reales, variantes y cartas ficticias; no soluciones por nombre o ID de PPP.

El piloto inicial incluye efectivo y transferencia. Mercado Pago, impresoras y ampliaciones de cocina no son el foco actual. El usuario aclaró que cocina recibe en pantalla; no hay impresión automática. No confundir una conexión WebSocket con evidencia de entrega efectiva de una orden.

Este documento propone criterios de salida; no acredita que el producto esté listo para vender, ni un porcentaje de avance.

## 2. Estado exacto al entregar

### Base validada y desplegada anteriormente

- Checkout de trabajo: `/home/levi/Documents/programming/PPP/PPP-NEST-staging`.
- Rama permanente: `staging`. HEAD local y referencia local origin/staging observados: `ef9b28214a1c704181776993d473360afd7c1457`.
- Código desplegado documentado: `d410291e`, incluye `620c982b`. `ef9b2821` es el cierre documental.
- Última verificación documentada del servidor: `2026-10-16T20:29:59.375186+00:00`; no se consultó otra vez el servidor al redactar este plan.
- Imagen documentada: `sha256:f81a5e34f651f892b9d4ce2150e1a6edd0e98af35bbb04850a0199c3bebbe64e`.
- En esa verificación: running/healthy, imagen activa=candidate, DB connected y circuito CLOSED.
- Esa fuente pasó 57 suites WhatsApp/6666 pruebas y 19 suites complementarias/98 pruebas: 76 suites/6764 pruebas disjuntas. No trasladar ese resultado al código local posterior.
- Main local en `/home/levi/Documents/programming/PPP/PPP-NEST`: `1a2b2e23` al redactar. No se modificó Main ni se reconstruyó producción en la tanda actual; esto no es una auditoría fresca del código efectivo de producción.

### Tanda local actual: sin commit, sin push, sin deploy

Cambios presentes que deben conservarse y revisar:

- `src/whatsapp/whatsapp-orchestrator.service.ts`: modificación de opción incluida más adicional; destino conocido por repartidores; prioridad de consultas de tiempo sobre aclaración de precio.
- `src/whatsapp/whatsapp-session-intents.ts`: aceptación de «a la misma» y direction/direcion.
- `src/whatsapp/whatsapp-general-accuracy.spec.ts`: 50 regresiones nuevas respecto de la base; 38 focalizadas aprobadas y 12 regresiones de familias aún sin cerrar. La suite contiene 5312 pruebas en total.
- `docs/whatsapp-model-budget.json`: una reproducción adicional de audio, contador 179.
- `docs/WHATSAPP-LOCAL-NEXT-AGENT.md`: relevo actualizado.
- `dist/tsconfig.tsbuildinfo`: archivo generado no seguido observado al redactar; no incluirlo en el commit de funcionalidad.

No resetear ni limpiar estos archivos para empezar. Revisar el diff antes de editar. Los archivos bajo /tmp son evidencia local temporal y pueden desaparecer: pasar resultados relevantes a informes durables en docs, sin datos personales ni credenciales.

## 3. Qué ya mejoró y qué no demuestra la evidencia

La versión desplegada contiene familias genéricas por prefijo de catálogo, compra repartida por opciones («dos Original y dos Zero»), dos presentaciones con atributos individuales y compartidos, inspección de carrito durante checkout y normalización de «Sí para Altavista».

Las pruebas usan el router, catálogo y carrito con dependencias externas simuladas. Un agente simulado que responde una frase fija no mide la capacidad del modelo real. Un texto transcrito reproducido en el router no mide reconocimiento acústico. Un health correcto tampoco demuestra comprensión de conversaciones.

La cantidad de tests no equivale a cobertura semántica total: muchos son variaciones de una misma familia. No sumar ejecuciones repetidas como escenarios únicos ni presentar un retest de desarrollo como muestra independiente.

## 4. Casos recientes: diagnóstico y siguiente acción

### P0 — Audio: plato principal perdido entre instrucciones y acompañamientos

Archivo original: `/home/levi/Downloads/WhatsApp Ptt 2026-10-16 at 3.23.18 PM.ogg`.

Texto acreditado tanto en reproducción como en transcripción almacenada: «Hola, buenas tardes. Me manda un pollo bien dorado con las pechugas partidas en cuatro, arepa frita pero bien dorado. Aparte me da por favor tres porciones de papa francesa, tres porciones de yuca y tres porciones de ensalada también. No se les olvide que el pollo bien dorado».

Falló la interpretación: agregó los acompañamientos y perdió el pollo. No culpar al transcriptor en este caso. El segmentador convierte cortes, cortesía y recordatorios en fragmentos candidatos a productos.

Resultado esperado: conservar un pollo, sus instrucciones y tres unidades de cada acompañamiento; «en cuatro» describe el corte, no cuatro pollos. Si falta definir frito/broaster, agregar lo entendido y aclarar únicamente esa presentación sin volver a agregar los acompañamientos al responder.

Implementación a explorar: separar identidad del plato, atributos, notas de preparación, adiciones explícitas y recordatorios. Usar catálogo para candidatos. Conservar contexto tipado cuando haya aclaración pendiente. No codificar «pollo», ID 1 o las porciones de PPP como excepción.

Pruebas existentes por cerrar: `spoken main dish with cut instructions and separately quantified sides`, seis casos, incluye pato ficticio. Agregar controles: otra cantidad de cortes, repetición de una nota, segundo producto realmente nuevo, cantidad explícita del principal y nota no soportada sin prometer disponibilidad.

### P0 — Producto válido buscado por sabor

«Agregas un jugo de guanábana» fue declarado inexistente, aunque había jugos en agua/leche con ese sabor configurado. La búsqueda debe considerar opciones del catálogo además del nombre, con un ancla de identidad para no confundir cualquier producto que comparta sabor.

Resultado esperado: mostrar las bases válidas y conservar guanábana al elegir leche; una sola unidad. Un sabor desconocido no debe sustituirse por uno conocido ni crear un producto.

Pruebas pendientes: `catalog attribute flavor is available before base selection`, seis casos en jugo, helado e infusión. Revisar `searchByNameScored`, extracción de consulta, umbral de ambigüedad y conservación de atributos en `tryResolvePendingMatchPick`. Cambiar una pieza, medir y después decidir si hace falta otro cambio.

### P1 — Opción incluida más compra adicional: corregido parcialmente en local

Después de una hamburguesa con «sin cebolla», «Con gaseosa coca cola y una adicionales De papa a la francesa» debía cambiar la bebida incluida y añadir solo las papas. Antes agregaba Coca-Cola independiente.

La corrección local identifica un único dueño por atributos del catálogo, una porción adicional inequívoca y comprueba la adición antes de aplicar. Las pruebas dejan dos líneas y conservan la nota. Hay controles con bowl/salsa/garbanzos.

Límites actuales: building_cart, sin pendingMatch/pendingMultiOrder/pendingAttribute. No declarar resueltos varios combos posibles, adicional con atributos obligatorios ni todas las formas de escribir. La implementación emite acuse del cambio y de la adición; revisar la conversación completa para evitar «¿algo más?» intermedio redundante.

Ampliar con «una porción adicional», «agrega también», dos adicionales, bebida ya elegida, dos platos con el mismo atributo, opción inexistente, pregunta hipotética y cambio durante pago. Si hay dos dueños, pedir cuál y conservar la compra adicional pendiente sin duplicar ni perderla.

### P1 — Confirmación de dirección: corregida en local

«A la misma», «Sí a la misma direction/direcion», «si, a la misma por favor» deben reutilizar la dirección guardada. Doce controles focalizados y el recorrido hamburguesa/adicional/cierre/reutilización pasan. El recorrido arranca desde la hamburguesa ya aceptada; no acredita el primer mensaje de compra con el agente simulado.

En el chat real hubo respuesta vacía. La reproducción local acredita que ahora se emite respuesta y llega al pago; no prueba la causa exacta de la ausencia de envío en Meta. Si reaparece: revisar recepción, cola, carrito persistido, respuesta generada y resultado del envío por separado.

### P1 — Referencia conocida por repartidores: corregida en local

«Los domiciliarios ya saben dónde es» no pregunta por la ubicación del restaurante y no autoriza recogida. Diez controles mantienen pedido/domicilio y piden calle/carrera o ubicación de WhatsApp sin fingir que se conoce el destino. Añadir controles negativos de pregunta real por el local y destino ya confirmado.

### P1 — Tiempo de llegada frente a precio: corregido en local

Los audios almacenados sí preguntaban cuánto tarda y confirmaban el pedido. El router los llevaba a aclaración de precio. Diez controles focalizados dan prioridad a la consulta de tiempo y retoman el paso pendiente. Confirmar sin método de pago aún solicita el método; no crea orden externa.

Ampliar con confirmación completa aislada, condición «solo si llega antes de…», pregunta mixta precio/tiempo y pedido ya confirmado. No confundir estimación configurada con promesa exacta ni confirmar una condición por inferencia.

## 5. Evidencia y comandos de continuación inmediata

Leer primero `AGENTS.md`, este documento y el inicio de `docs/WHATSAPP-LOCAL-NEXT-AGENT.md`. El historial grande `docs/AGENT-HANDOFF-WHATSAPP.md` contiene estados antiguos: no elegir el último despliegue por una entrada histórica.

Inspección inicial:

```bash
cd /home/levi/Documents/programming/PPP/PPP-NEST-staging
git status --short
git branch --show-current
git fetch origin staging
git log --oneline --left-right HEAD...origin/staging
git diff --stat
git diff -- src/whatsapp/whatsapp-orchestrator.service.ts src/whatsapp/whatsapp-session-intents.ts
```

Si origin avanzó, revisar antes de integrar; no hacer reset ni merge automático sobre cambios sin commit. Si otro editor modifica la fuente, coordinar antes de la validación global.

Reproducciones rojas que hay que cerrar primero:

```bash
npx jest --runInBand --silent --testPathPattern=whatsapp-general-accuracy --testNamePattern='spoken main dish with cut instructions|catalog attribute flavor'
```

Controles actualmente aprobados:

```bash
npx jest --runInBand --silent --testPathPattern=whatsapp-general-accuracy --testNamePattern='included option change with independent side purchase|burger included drink and saved address continuation|courier knows destination|saved address affirmative|draft arrival time'
```

Logs observados: `/tmp/ppp-mixed-option-target.log` (38 aprobadas, 5274 omitidas por filtro), `/tmp/ppp-mixed-option-related.log` (105 aprobadas/2 suites), `/tmp/ppp-current-checkout-tsc.log` (TypeScript aprobado). Baselines: `/tmp/ppp-spoken-destination-baseline.log`, `/tmp/ppp-arrival-attribute-baseline.log`. Los baselines incluyen casos ahora corregidos: no copiar sus conteos como estado final.

Después de cerrar ambas familias y ampliar los controles relevantes:

```bash
npx tsc --noEmit
npx jest --runInBand --silent --testPathPattern=whatsapp
npx jest --runInBand --silent --testPathIgnorePatterns=whatsapp
```

Capturar salida y código de retorno en archivos nuevos. Congelar y registrar hashes de src/scripts antes; no editar durante estos runs. La global histórica tarda aproximadamente 11–16 minutos: esperar no significa bloqueo. Verificar la misma fuente al final. El número de suites/pruebas puede aumentar; no fijarlo como una constante esperada. No omitir los tests rojos para declarar una global verde.

## 6. Método para dejar de parchear chat por chat

Trabajar por familias de comportamiento con invariantes verificables:

1. Clasificar el fallo por capa: transcripción/visión, recuperación de catálogo, interpretación, decisión/acción, persistencia o envío.
2. Guardar el ejemplo real y su resultado esperado antes de tocar producción.
3. Probar invariantes: ninguna pregunta agrega productos; ninguna consulta se guarda como nombre/dirección; cambio de atributo no compra otro SKU; cantidades de cortes/códigos no cuentan unidades; respuesta solo afirma acciones persistidas.
4. Crear variantes de redacción y al menos una carta ficticia distinta. Incluir un control negativo y contexto anterior distinto.
5. Corregir el contrato más pequeño que explica la familia. Evitar otro regex prioritario si el mismo concepto ya tiene un resolvedor reutilizable.
6. Medir en el router completo con modelo/Meta/DB/mapas simulados. Revisar todos los mensajes emitidos, no solo el último o el carrito final.
7. Mantener muestras nuevas sin ajustar a ellas para contraste con el modelo real; etiquetar desarrollo frente a evaluación independiente.

Dirección de arquitectura: extracción estructurada de intenciones y entidades; vinculación por catálogo y contexto; plan de acciones validado; aplicación consistente al estado; respuesta derivada del resultado. Las reglas deterministas deben proteger cantidades, dinero y estado, y no bloquear preguntas libres por estar esperando un dato. No reescribir todo el orquestador ahora: introducir contratos pequeños y migrar una familia a la vez con regresiones.

## 7. Próximas tandas después de cerrar lo actual

Orden sugerido:

1. Reparación de carrito previamente dañado: «no era la Coca sola, era la del combo», «me falta X» cuando X ya existe. No eliminar productos legítimos ajenos ni duplicar por reexplicar.
2. Interrupciones en nombre, teléfono, dirección, sabor, pago y confirmación: precio, composición, tiempo, ver carrito, cambiar/quitar, volver y cancelar. Resolver consulta y retomar el pendiente; cambiar datos invalida solo confirmaciones afectadas.
3. Pedidos narrados: varios grupos, «ambos», «el otro», «uno de cada», notas por grupo, repetición, corrección y mensaje con dirección/pago. Comprobar totales y atributos individuales.
4. Ráfagas: mismo item repartido en varios mensajes, turnos concurrentes, duplicado de webhook, imagen sin texto, audio seguido de corrección. Una intención no debe ejecutarse dos veces.
5. Catálogo: nombres completos en listados, agotados, productos similares, términos sinónimos, sabores, tamaños y preguntas aleatorias. No inventar disponibilidad, rendimiento o recargos.
6. Puntos: diferenciar saldo, acumular, redimir y aplicar premio; responder a la intención concreta sin soltar toda la guía. No acreditar un canje solo por redactar que ocurrió.
7. Medios: distinguir calidad de reconocimiento y calidad del parser; fotos con varios ítems/cantidades/opciones y audios originales cuando existan. Incluir silencio, audio incompleto y confianza baja sin escalación humana automática.
8. Aislamiento Kamppo: misma suite de contratos con dos catálogos, configuraciones y sesiones de tenant distintos; ningún precio, producto, alias, premio o conversación puede cruzar tenants. La migración requiere adaptadores, no copiar excepciones PPP.

No es necesario agotar infinitas variantes antes de un piloto, pero sí cerrar fallos críticos conocidos y medir conversaciones completas nuevas.

## 8. API real, modelos y costos

Modelos efectivos documentados en staging: agente `gpt-6.1-sol`; visión y assist `gpt-6-luna`; audio `gpt-transcribe`. Revalidar configuración efectiva antes de inferir paridad con producción. No cambiar modelo como primera explicación de un fallo determinista. No prometer duración futura del modelo sin verificar documentación oficial.

Presupuesto operativo compartido actual: 183 acumuladas, 179 usadas, 4 restantes. Es un tope operativo elegido por el agente bajo autorización persistente del usuario, no una cifra nueva dictada por él. Fuente `docs/whatsapp-model-budget.json`; espejo privado `/home/levi/Documents/Codex/2026-10-09/t/work/authorized-model-budget.json`. Registrar intentos antes de red; fallos también cuentan. No reiniciar contadores.

La última reproducción del audio consumió una llamada HTTP200, 21 segundos reportados, costo estimado USD 0.001575, no factura. Reportes privados `/tmp/ppp-original-audio-result.json` y `/tmp/ppp-original-audio-stored.json`. La credencial temporal fue eliminada. No repetir el audio para arreglar el parser: ya existe texto reproducible.

El runner `scripts/whatsapp-live-router-rehearsal.ts` hace inferencia pagada; no lanzarlo por rutina. Exige flag live, credencial privada y máximo explícito. **Su fallback de modelo es histórico `gpt-4o-mini`: pasar explícitamente el modelo deseado** y revisar también overrides del entorno. Una conversación con herramientas puede gastar varias llamadas, no una por mensaje. Ejecutar una muestra acotada, detener al primer fallo y diagnosticar gratis antes de repetir. No gastar el saldo en muestras que ya fallan sin modelo.

Medir costo por conversación y pedido completo, incluyendo herramientas, audio, visión y reintentos; registrar p50/p95 de latencia con muestra declarada. La rentabilidad de suscripción requiere además tráfico y costos operativos por tenant; las pruebas actuales no la demuestran.

## 9. Publicación y despliegue cuando todo esté verde

Solo staging en esta continuación; una integración a Main requiere una nueva solicitud aplicable del usuario. Conservar ambas ramas.

1. Revisar diff y secretos; no subir archivos personales ni dist/tsconfig.tsbuildinfo.
2. Registrar fuente, tests, límites y llamadas/costos en informe durable.
3. Commit de cambios revisados y push a origin/staging. Publicar rama no equivale a desplegar.
4. En servidor autorizado `root@76.13.119.125` con llave configurada:

```bash
set -e
cd /opt/ppp-staging
test "$(git branch --show-current)" = staging
git fetch origin staging
git merge --ff-only origin/staging
docker compose --env-file .env.staging -p ppp-staging -f docker-compose.staging.yml up -d --build api
```

5. Verificar HEAD, estado running/healthy, imagen activa=candidate, funciones nuevas compiladas y `https://dev.prontopolloportal.com/api/health` (DB y circuito). Comparar solo variables de modelos permitidas sin imprimir .env.
6. Documentar evidencia y limitaciones; el cierre documental posterior puede actualizarse sin reconstruir si no cambia código.

No usar compose general, --remove-orphans, borrar volúmenes ni tocar mariadb_local. No confirmar órdenes externas de prueba sin revisar aislamiento efectivo. La autorización de reiniciar pedidos sintéticos no autoriza borrar clientes reales.

## 10. Puerta de salida al piloto y después a venta

Criterios propuestos para piloto supervisado:

- Cero fallos críticos conocidos reproducibles en la tanda candidata: pérdidas/duplicados, cantidades erróneas, opciones confundidas con productos, dirección ignorada, precio inventado o confirmación indebida.
- Global y TypeScript verdes sobre una misma fuente; todas las familias anteriores cerradas o excluidas explícitamente del alcance del piloto sin prometerlas al cliente.
- Conversaciones nuevas completas con modelo real y pruebas de canal aisladas: pedido, corrección, consulta intermedia y cierre. Registrar muestra y fallos, no solo aciertos.
- Respuestas coinciden con carrito persistido; nunca afirmar un cambio que no ocurrió. Recuperación clara cuando falta información.
- Configuración del candidato verificada y procedimiento de reversión al commit/imagen anterior conservado.
- Operador disponible en piloto; resultados revisados por conversación, con datos personales protegidos y gasto limitado.

No se fija una fecha sin cerrar esos puntos. Venta amplia exige además observación del piloto, soporte, métricas de éxito/corrección/abandono, latencia/costo, aislamiento multitenant y revisión operativa de entrega/pago; el usuario pidió posponer esa parte técnica mientras cerramos comprensión.

## 11. Primer bloque concreto para quien retome

1. Leer diff y confirmar staging/ausencia de otro editor.
2. Ejecutar solo las 12 regresiones pendientes para medir la fuente actual.
3. Cerrar audio principal/instrucciones/adicionales; correr sus controles.
4. Cerrar recuperación por sabor/base; correr controles y desconocidos.
5. Ampliar límites de bebida incluida/adicional sin duplicar handlers.
6. Revisar 38 controles locales y nuevas regresiones, después TypeScript y global congelada.
7. Contraste acotado real solo si hace falta y cabe en presupuesto.
8. Publicar, desplegar y verificar staging; informar exactamente qué queda disponible para que el usuario pruebe.

No empezar con más llamadas pagadas, otro cambio de modelo, otra rama o una promoción a Main. El siguiente avance medible es cerrar las dos familias pendientes sobre la tanda local existente.
