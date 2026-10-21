# Relevo operativo: probar y corregir WhatsApp PPP

## Punto de entrada y alcance

Checkout: `/home/levi/Documents/programming/PPP/PPP-NEST-staging`. Rama permanente `staging`; remoto `origin/staging`. No tocar `Main` ni producción sin una nueva solicitud. Leer AGENTS.md, el comienzo vigente de WHATSAPP-LOCAL-NEXT-AGENT.md y whatsapp-next-batches.md. AGENT-HANDOFF-WHATSAPP.md conserva historia; no asumir que sus modelos, presupuestos o SHAs antiguos siguen vigentes.

Actualizado 21/10 tras la tanda 96: runtime desplegado en staging 389bfcf5 (health OK 2026-10-21 22:33Z); producción promovida por pedido del usuario a Main 54c057b5 (tandas hasta 94, imagen 1d512d0c…, health OK 21:52Z) y luego intacta. Las tandas 45–81 se registraron en WHATSAPP-LOCAL-NEXT-AGENT.md y whatsapp-next-batches.md sin actualizar este runbook. No hay código publicado pendiente de despliegue. Verificar de nuevo Git y servidor antes de actuar; la entrada más reciente de WHATSAPP-LOCAL-NEXT-AGENT.md manda sobre estos SHAs. El schedule fue eliminado: no recrearlo. No hay autorización implícita para otro agente concurrente, llamadas pagadas, mensajes WhatsApp ni órdenes externas en una tanda gratuita.

## Arranque sin pisar trabajo

```bash
cd /home/levi/Documents/programming/PPP/PPP-NEST-staging
git status --short
git branch --show-current
git fetch origin staging
git rev-list --left-right --count HEAD...origin/staging
ps -eo pid,etime,args | rg 'jest|tsc|docker compose'
```

Si hay una validación/edición/despliegue activo, no lanzar otro sobre esta fuente. Conservar cambios ajenos y archivos privados. No resetear ni limpiar el checkout indiscriminadamente. Leer diferencias y commits antes de integrar. Solo avanzar con fast-forward si corresponde.

## Cómo diseñar una tanda útil

1. Elegir una familia de fallos y un criterio observable: por ejemplo, cambiar una unidad de la línea correcta sin modificar las restantes.
2. Reproducir el chat exacto con el router real y dependencias externas simuladas. Guardar baseline; distinguir errores del fixture de errores del producto.
3. Añadir contrastes que podrían romper una regla demasiado amplia: consulta frente a compra, atributo frente a nota, cantidad válida/excesiva, referente único/ambiguo, interrupción del checkout, repetición, cancelación y recuperación.
4. Usar dos o tres catálogos con estructuras distintas. Las reglas de ejecución no contienen productos/IDs/precios de PPP. Cambiar solo nombres no acredita diversidad estructural.
5. Probar agente simulado habilitado y deshabilitado cuando importe. El mock no acredita comprensión del modelo real. Una prueba que devuelve la acción esperada del mock solo valida la aplicación de esa acción.
6. Afirmar respuesta, carrito (incluidas unidades, atributos, notas y precio), estado/pendientes y DTO final de la orden simulada. Verificar que no se creó una orden antes de confirmar. Para solicitudes rechazadas, comprobar ausencia de mutación.
7. Si la prueba comienza con carrito sembrado, declararlo; no llamarla compra completa desde cero. Una aclaración debe probarse hasta resolverla, no solo hasta la pregunta.
8. Corregir el mecanismo general más pequeño. No añadir sinónimos o excepciones por cada chat sin comprobar el contexto y el catálogo.

El harness está en `src/whatsapp/whatsapp-accuracy.test-support.ts`. Usar `sendQueued` para el flujo con retención de respuestas. Devuelve el último mensaje; para comprobar toda una respuesta de varios mensajes, capturar `replies.slice(indiceInicial)`. Ráfagas simultáneas requieren probar `handleIncoming` y temporizadores; varios `sendQueued` seriales no prueban concurrencia.

## Evitar cuellos de botella

La suite histórica fue repartida en doce archivos `whatsapp-general-accuracy*.spec.ts`. No volver a reunirlos ni importar un spec desde otro. Compartir únicamente helpers. `test:whatsapp:accuracy` cubre esos archivos históricos, NO todos los specs nuevos.

Durante desarrollo ejecutar solo la familia y los contratos afectados:

```bash
npx jest whatsapp-existing-variants-block --runInBand --silent
npx jest 'whatsapp-(existing-variants-block|unit-option-plan)' --runInBand --silent
npx jest whatsapp-general-accuracy --maxWorkers=4 --silent --testNamePattern='Partial unit option'
```

Agrupar recorridos relacionados y correr una global al cerrar el bloque, no por cada ocho variantes. Máximo probado: cuatro workers; no lanzar varias suites globales ni aumentar workers sin medir memoria y tiempos. No gastar tokens imprimiendo miles de líneas de telemetría: redirigir a /tmp y consultar fallos/resumen.

La suite `whatsapp-general-accuracy.spec.ts` contiene ráfagas con temporizadores y ha tenido timeouts esporádicos de 5s bajo carga. Pasaron aislados, pero eso no convierte la global original en verde. No aumentar el timeout ni eliminar aserciones para ocultar el problema. Estrategia validada una vez el 19/10: ejecutar esa suite serialmente y el resto con cuatro workers, en dos fases SIN superposición, comprobando que la unión de archivos/casos coincide con la global. Los comandos son:

```bash
# Fase de ráfagas, aislada
npx jest --runTestsByPath src/whatsapp/whatsapp-general-accuracy.spec.ts --runInBand --silent --json --outputFile=/tmp/ppp-burst-global.json > /tmp/ppp-burst-global.log 2>&1
# Solo después de finalizar la anterior; patrón exacto, no excluir part-02…part-12
npx jest --maxWorkers=4 --testPathIgnorePatterns='/whatsapp-general-accuracy.spec.ts$' --silent --json --outputFile=/tmp/ppp-rest-global.json > /tmp/ppp-rest-global.log 2>&1
```

Verificar inventario con `npx jest --listTests --runInBand --json` y comparar rutas de ambos resultados; cero faltantes/duplicados. Si una fase falla, conservar el informe y reproducir el fallo. Reportar por separado global y reintentos. Los archivos temporales /tmp no son evidencia durable: registrar resumen y límites en docs.

## Controles al cerrar

```bash
npx tsc --noEmit
npx tsc --noEmit -p tsconfig.build.json
node --test scripts/*.test.cjs
git diff --check
```

Antes de la global congelar y guardar SHA-256 de todos los archivos en src/, scripts/, .github/workflows/, package.json y tsconfig.build.json; comprobarlos al finalizar. No editar ni ejecutar otra validación durante la global. Limpiar solo los buildinfo generados por esta tanda si estaban limpios inicialmente; nunca restaurar trabajo ajeno. Una global anterior no acredita código editado después.

Documentar: base/commit, objetivo, casos nuevos frente a existentes, baseline real, controles, conteos/tiempos, hashes, fuente de los fixtures, mocks, fallos/reintentos, límites y próximo bloque. Actualizar el comienzo del relevo vigente y next-batches. No declarar vendible por conteos ni que todo el PDF está cubierto. Mantener una lista de conversaciones no reproducidas y una evaluación reservada con modelo real separada de estos replays.

## Publicar y desplegar

Commit explícito de archivos propios y `git push origin staging`. Publicar NO es desplegar. Agrupar despliegues. Solo servidor autorizado root@76.13.119.125, checkout /opt/ppp-staging, compose docker-compose.staging.yml, env privado .env.staging, proyecto ppp-staging.

Antes: comprobar rama, cambios locales y HEAD remoto; conservar bin/ privado. Guardar imagen actual como rollback. Actualizar por fast-forward y verificar SHA exacto. Construir solo API:

```bash
docker compose --env-file .env.staging -p ppp-staging -f docker-compose.staging.yml up -d --build api
```

Después: verificar HEAD, imagen/contenedor running, reinicios y https://dev.prontopolloportal.com/api/health; comparar imagen de producción antes/después. No usar compose general, remove-orphans ni borrar volúmenes. No reconstruir por commits exclusivos de documentación. Ante fallo de health, investigar/recuperar staging; no tocar producción. Nunca imprimir secretos.

## Siguientes objetivos

Resueltos en tandas 20–44 y 82–96 (45–81: ver WHATSAPP-LOCAL-NEXT-AGENT.md) (no repetir): poco arroz/ensalada como nota, demora tras orden, «2» tras aclaración, dos atributos, notas contradictorias y sus formas sueltas, orden creada sin «confirmar» dentro del turno, línea nombrada por su opción, adicional cobrado nombrado sobre líneas, cambio/destinatario/urgencia como datos del pedido «gracias» con pedido abierto y notas de manejo/empaque sueltas («aparte», «bien empacado», «que no se riegue») nota + cambio en un mismo mensaje y adicional por línea con cantidad explícita, referencia en singular y retiro por línea, y cambio de nombre en checkout con acuse (antes «el pedido va a nombre de X» creaba la orden sin «confirmar»), «listo/va/ok, <cambio>» que aplica el cambio, «para recoger»/«mejor a domicilio» en el paso final y ±1 con una sola línea, y ráfagas durante una duda pendiente (la respuesta corre primero; una aprobación tras un cambio en la misma ráfaga no crea la orden), «y otro de <variante>» (antes se guardaba como dirección) y plato por su nombre principal («agrega una arepa») en carrito, pago y paso final, y ±1 sobre una línea nombrada con varias líneas («quita una de mora» antes se guardaba como dirección o borraba la línea entera), y paso de nombre que guardaba cortesías/frases/platos como nombre del pedido, y dirección durante una opción/lista pendiente (antes perdía el plato; la opción escrita con la dirección se aplica), y bucle del «número de orden», aviso «No tenemos esos productos» repetido y «Eso no lo resuelvo» a preguntas de estado, y foto de producto con el pedido en su texto (código propio rechazado por el agente, contacto perdido, «1» tras el rechazo agregaba el código 1), y «no quiero un X» que conservaba la línea, «no quería X, quería Y» que abría variantes y cambio explícito con agente on que agregaba ambos platos, y «quita todo el <plato>» que vaciaba el carrito («todos los», «todo lo del», «una unidad de»), y cambio de acompañante («a cambio de la A, B», «con A en vez de B», «cambiando la B por A») que agregaba porciones aparte, «dos <plato> una de X y una de Y» sin dos puntos y cantidades tomadas como nombre del cliente, y mismo producto con opciones distintas en un mensaje («1 sopa de A y 1 sopa de B», tamaño dicho en bebidas, «×2» repetido en la respuesta), y número suelto tras cotizar un plato leído como código («¿cuánto vale X?» → «2»), y «¿traen gaseosa?» tras listar platos contestado con la lista de gaseosas, y varias filas de la lista en un mensaje («1 o 2» perdía la lista; «el 1 y el 2» o «2 de la primera y 1 de la segunda» agregaban solo una fila), y «buenos días, uqe me ofreces» contestado con el empujón genérico («qué me ofreces», errores de tipeo de «que», «qe hay de comer»), y pregunta por una familia de platos que mostraba o agregaba uno solo («qué hamburguesas tienen?», «quiero ver las lasagnas», plural suelto; «hamburguesas» leído como código de puntos), y nota para algunas unidades que anotaba todas («dos hamburguesas, una sin cebolla», «una sin cebolla» tras pedir dos; «una sin alcaparras» perdida por ingrediente fuera de lista), y nota sin plato con varias líneas que caía en la última o preguntaba sin entender la respuesta («una sin cebolla», «sin cebolla» → «2»/«la doble», «la hamburguesa sin cebolla»), y del chat real del combo: fila de lista con palabras leída como cantidad («El combo 2 por fa» → ×2), respuesta con la opción de la línea vieja, «Solo pedí un combo» / «Dame solo el combo número 2» sin efecto, «Cancela ya lo pedí por llamada» buscado como producto, cancelar con orden registrada con «No entendí» y nombre exacto de combo tras «quiero un» tomado como fuera de carta, pregunta «ese viene con papa…?» sobre el plato del carrito respondida con la ficha del acompañamiento y «una porción de papa con el combo» reabriendo la lista del combo, nota repetida con y sin tilde, opción por defecto ignorada o convertida en producto aparte al responder la bebida, bebida del plato agregada aparte en pedido con comas, «cambiar mi dirección» y muletilla «me lo envías a» en la dirección, «domicilio» / «envíamelo» ignorados en el pago de un pedido para recoger; platos que empiezan por «arepa» y acompañamientos pedidos solos enviados al agente en vez de agregarse; lugar dicho antes de la calle («me lo envías a <lugar>», «Anoté la referencia») perdido al llegar la calle; artículo de lugares como «Los Almendros» / «El Prado» borrado en la referencia; nombre con apellido de lugar («… Torres») guardado como dirección, pin reemplazado por el nombre del conjunto y queja por el valor del domicilio sin explicación, opción abierta respondida con número y nota de servicio («2 que esté fría porfavor», «2 por favor») sin elegir y nombre de opción con temperatura que perdía la nota, pregunta del monto a pagar («Te transformo 57.000?») sin total y respuesta del agente que anunciaba «agregué» sin aplicar nada. Auditado sin cambio (tanda 26): tryConfirmOrder no tiene llamadores fuera de un turno entrante.

- Huecos de la auditoría de 130 chats reales del 18/10 (tanda 35, ver entrada en WHATSAPP-LOCAL-NEXT-AGENT.md), por impacto: (resuelto en tanda 36: opción pendiente perdida cuando llega la dirección, 11 → 7 sin duda pendiente); (resuelto en tanda 37: bucle del número de orden 6 → 0, aviso repetido 7 → 0, «no lo resuelvo» a preguntas de estado 8 → 0); (resuelto en tanda 38: foto con pedido en el texto y «1» tras rechazo del agente); (resuelto en tanda 39: «no quiero un X»/«no quería X, quería Y»); (resuelto en tanda 40: «quita todo el <plato>» vaciaba el carrito); (resuelto en tanda 41: cambio de acompañante como nota y reparto sin dos puntos); (resuelto en tanda 42: mismo producto con opción repetido con conteos explícitos); (resuelto en tanda 43: número suelto tras cotizar un plato; queda «1» tras «¿Qué se te antoja?»); (resuelto en tanda 44: «¿traen gaseosa?» tras listar platos; quedan acompañantes «¿traen papas?»); saludos/cortesías/muletillas en la línea del pedido dan «no manejamos» y a veces pierden el pedido (42); dirección que absorbe «; Para»/«; Te»/cortesías (~15); «cuánto es?» con varias líneas pregunta de cuál producto (4); combos (~10); «gaseosa 7 up» como cantidad 7; quedan «no lo resuelvo» para «?» suelto/horario (8); hora tras «para» guardada como dirección; palabra de familia en mensaje de varios platos elige variante en silencio.
- Asides compuestos con «y»/«con» («la salsa aparte y bien empacado»); dos notas independientes o dos montos de cambio en un mensaje; cambio de nombre en el paso final sin acuse.
- Auditado (tanda 31): 25 combinaciones de dato + palabra de aprobación en el paso final; ninguna crea la orden sin «confirmar». Pendiente menor: acuso al final («mi número es …, va») sin acuse explícito; la pregunta «¿De cuál…?» del ±1 no guarda selección pendiente.
- Con agente activo, compras como «y agrega <plato>» o «quiero una arepa de queso» se delegan al agente (ruta existente; recibe el producto resuelto). «agrega un jugo» en el paso final abre la lista y baja a building_cart.
- Huecos del adicional por línea: adicionales con opciones configurables; dos cantidades en un mensaje.
- Vigilar duración de la global (417 s tanda 23, 661 s tanda 24, 424 s tandas 25–27, 411 s tanda 28, 417 s tanda 29, 427 s tanda 30, 437 s tanda 31, 433 s tanda 32, 443 s tanda 33, 439 s tanda 34, 435 s tanda 35, 430 s tanda 36, 454 s tanda 37, 449 s tanda 38, 457 s tanda 39, 438 s tanda 40, 487 s tanda 41, 484 s tanda 42, 468 s tanda 43, 562 s tanda 44, 472 s tanda 82, 476 s tanda 83, 439 s tanda 84, 451 s tanda 85, 468 s tanda 86, 470 s tanda 87, 474 s tanda 88, 454 s tanda 89, 452 s tanda 90, 494 s tanda 91, 478 s tanda 92, 524 s tanda 93, 501 s tanda 94, 489 s tanda 95, 513 s tanda 96) y que la unión de ambas fases coincida con --listTests.
- Estado del piloto: consultar WHATSAPP-COMMERCIAL-READINESS-PLAN.md. Un caso ya corregido localmente puede seguir fallando en un runtime anterior; comparar versiones antes de duplicar parches.

## Resultado de esta tanda de relevo (19/10)

Los dos casos exactos ya pasan en la fuente base f0b5221b: 18 regresiones nuevas, tres menús y dos modos del agente simulado. No hubo cambio de runtime. La global en dos fases aprobó 80 + 9.714 tests (105 suites) con inventario exacto y 399 hashes intactos. Duración: 106,098 + 331,929 = 438,027 segundos. No fue más rápida que la global anterior; esta ejecución evitó los timeouts sin alterar límites ni reintentar. Una ejecución no demuestra estabilidad permanente. TypeScript, build TypeScript y 92 Node también aprobados. Evidencia: whatsapp-reduced-sides-postorder-validation-1910.json.

No se desplegó: cambios exclusivos de pruebas/documentación. El código f0b5221b de la tanda anterior sigue pendiente de despliegue agrupado; último runtime acreditado 49812461. Consultar siempre la entrada más reciente del relevo antes de usar estos SHAs históricos.
