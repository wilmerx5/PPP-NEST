# Relevo operativo: probar y corregir WhatsApp PPP

## Punto de entrada y alcance

Checkout: `/home/levi/Documents/programming/PPP/PPP-NEST-staging`. Rama permanente `staging`; remoto `origin/staging`. No tocar `Main` ni producción sin una nueva solicitud. Leer AGENTS.md, el comienzo vigente de WHATSAPP-LOCAL-NEXT-AGENT.md y whatsapp-next-batches.md. AGENT-HANDOFF-WHATSAPP.md conserva historia; no asumir que sus modelos, presupuestos o SHAs antiguos siguen vigentes.

Actualizado 19/10 tras la tanda 25: runtime desplegado en staging 86d5a3d7 (health OK 23:20Z); producción c5e97ab1… intacta. No hay código publicado pendiente de despliegue. Verificar de nuevo Git y servidor antes de actuar; la entrada más reciente de WHATSAPP-LOCAL-NEXT-AGENT.md manda sobre estos SHAs. El schedule fue eliminado: no recrearlo. No hay autorización implícita para otro agente concurrente, llamadas pagadas, mensajes WhatsApp ni órdenes externas en una tanda gratuita.

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

Resueltos en tandas 20–25 (no repetir): poco arroz/ensalada como nota, demora tras orden, «2» tras aclaración, dos atributos, notas contradictorias y sus formas sueltas, orden creada sin «confirmar» dentro del turno, línea nombrada por su opción, adicional cobrado nombrado sobre líneas.

- Llamadas a tryConfirmOrder fuera de un turno entrante (la firma del pedido solo protege dentro del turno).
- Ráfagas concurrentes reales (handleIncoming + temporizadores) durante una duda pendiente.
- Huecos del adicional por línea: cantidad explícita, referencia por producto en singular, adicionales con opciones, retirarlo por la línea.
- Vigilar duración de la global (417 s tanda 23, 661 s tanda 24, 424 s tanda 25) y que la unión de ambas fases coincida con --listTests.
- Estado del piloto: consultar WHATSAPP-COMMERCIAL-READINESS-PLAN.md. Un caso ya corregido localmente puede seguir fallando en un runtime anterior; comparar versiones antes de duplicar parches.

## Resultado de esta tanda de relevo (19/10)

Los dos casos exactos ya pasan en la fuente base f0b5221b: 18 regresiones nuevas, tres menús y dos modos del agente simulado. No hubo cambio de runtime. La global en dos fases aprobó 80 + 9.714 tests (105 suites) con inventario exacto y 399 hashes intactos. Duración: 106,098 + 331,929 = 438,027 segundos. No fue más rápida que la global anterior; esta ejecución evitó los timeouts sin alterar límites ni reintentar. Una ejecución no demuestra estabilidad permanente. TypeScript, build TypeScript y 92 Node también aprobados. Evidencia: whatsapp-reduced-sides-postorder-validation-1910.json.

No se desplegó: cambios exclusivos de pruebas/documentación. El código f0b5221b de la tanda anterior sigue pendiente de despliegue agrupado; último runtime acreditado 49812461. Consultar siempre la entrada más reciente del relevo antes de usar estos SHAs históricos.
