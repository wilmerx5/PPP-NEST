# Continuación local de PPP WhatsApp

Estado verificado al 14/10/2026, 22:34 Bogotá. Este es el punto de entrada breve; el historial completo está en `AGENT-HANDOFF-WHATSAPP.md`. Las secciones antiguas de ese historial no representan el presupuesto ni el despliegue actual.

## Procedimiento vigente: entregas locales acumuladas

El usuario pidió no desplegar por cada ajuste. La entrega actual consolida contratos localmente y NO debe desplegarse automáticamente. Se puede publicar trabajo validado en la rama staging sin reconstruir el servidor. El runtime verificado que se enumera abajo sigue siendo el anterior hasta un deploy explícito de una entrega acumulada.

## Objetivo y alcance autorizado

Crear un chatbot vendible con piloto supervisado, empezando en PPP y posteriormente adaptándolo a Kamppo multitenant. Prioridad del usuario: entender mensajes humanos, typos, notas, cantidades, opciones, pedidos largos, ráfagas, correcciones e interrupciones. No dedicar esta fase a cocina, impresoras o Mercado Pago. Piloto con efectivo y transferencia. El usuario pide continuar corrigiendo y probando staging, preservar esa rama y no publicar nuevas mejoras en Main sin solicitud.

No declarar vendible por cantidad de tests ni asignar un porcentaje inventado. Los errores recientes muestran que el modelo puede interpretar bien y el backend aplicar o responder mal. Separar interpretación del modelo, cambios de estado/carrito y respuesta al usuario.

## Abrir el checkout correcto

- Repo de trabajo: `/home/levi/Documents/programming/PPP/PPP-NEST-staging`.
- Rama permanente: `staging`; remoto `https://github.com/wilmerx5/PPP-NEST.git`.
- Código verificado desplegado: `d1c7d8fc`; puede haber un commit posterior solo de documentación. Comprobar HEAD local/remoto antes de editar.
- Main local: `/home/levi/Documents/programming/PPP/PPP-NEST`, rama `Main`, `d9241abe`; producción también `d9241abe`. Ambos se verificaron intactos.
- `/home/levi/Documents/Codex/2026-10-09/t` es la carpeta del chat, NO el checkout activo. Hay copias antiguas en `work/`; no editar esas copias ni usarlas para desplegar.
- Leer `AGENTS.md`, este documento, el final del historial y `docs/whatsapp-model-budget.json`. Revisar status, fetch y comparar HEAD antes de editar. Si aparecen cambios ajenos, preservarlos.
- No crear ramas/worktrees por rutina, borrar staging, limpiar stashes ni lanzar subagentes sin autorización aplicable. Stash histórico preservado: `edd763f8adb87bd445dc8235e37e17258133e54b`.

Inicio:

```bash
cd /home/levi/Documents/programming/PPP/PPP-NEST-staging
git status --short
git branch --show-current
git fetch origin staging
git rev-parse --short HEAD
git rev-parse --short origin/staging
```

## Estado aprobado y límites de la evidencia

- Global final: **67 suites / 5.353 tests aprobados**, 869.815 s.
- 62 regresiones nuevas en la última tanda (incluye cambios locales preexistentes), 88 focalizadas aprobadas y TypeScript sin errores. Fuente congelada y snapshot idéntico al finalizar.
- Logs locales: `/tmp/ppp-kitchen-local-full.log`, `/tmp/ppp-kitchen-local-final2.log`, `/tmp/ppp-kitchen-local-tsc-final.log`, `/tmp/ppp-kitchen-local-source.json`.
- Staging: `d1c7d8fc`, running/healthy; imagen activa y candidate iguales: `sha256:667de89f18c7ce63f0573a6284ac2b0fad2b11433051cd8b11c9373702f150e0`. HTTP health ok, DB connected, circuit CLOSED.
- Deploy/health: `/tmp/ppp-kitchen-local-deploy.log`, `/tmp/ppp-kitchen-local-verified-final.log`. `/tmp` puede desaparecer: el resumen verificado está en Git.
- Modelo de texto real de esta tanda: **gpt-4.1-2025-04-14**, usando configuración privada de staging. No cambiar modelos por intuición ni afirmar una comparación nueva con producción; releer configuración si es necesario.
- Agente activo en staging y producción en última comprobación de env: `WHATSAPP_AGENT_V1=true`. Esto no demuestra que todos los turnos lleguen al modelo: muchos handlers deterministas interceptan antes.
- Jest simula modelo/Meta/persistencia/órdenes. El runner real usa router y modelo real, pero también aísla Meta, persistencia, cotización y órdenes. No equivale a WhatsApp real ni acredita percepción de audio/foto.

## Presupuesto: agotado

**50 autorizadas / 50 usadas / 0 restantes.** No hacer más inferencias pagadas sin nueva autorización del usuario. Continuar trabajo gratuito. No resetear contadores al cambiar agente o proceso.

La última tanda usó11 solicitudes:10 adicionales autorizadas por «continua, si quieres autoriza ams llaamadas» y1 pendiente anterior. Cada intento se contabilizó antes de red, incluidos fallos. Fuente de saldo: campos superiores de `docs/whatsapp-model-budget.json`; `evaluationHistory` registra los ensayos recientes. `latestEvaluation` conserva una evaluación histórica y no reemplaza el saldo actual.

Espejo privado: `/home/levi/Documents/Codex/2026-10-09/t/work/authorized-model-budget.json`. Debe mantenerse sincronizado cuando exista nueva autorización/uso. No imprimir ni guardar keys, tokens, passwords o env completos. No estimar gasto exacto con número de solicitudes; se registraron tokens, pero no precio monetario de4.1 en estos informes.

## Qué cambió recientemente

1. `whatsapp-dialogue-context.ts`: referencias compartidas para consultas de composición/rendimiento. Pendientes/oferta tienen prioridad sobre foco viejo; varios candidatos requieren aclaración. Es una extracción parcial: NO se ha consolidado todo el orquestador.
2. Consultas intercaladas mientras falta teléfono conservan pedido y vuelven al teléfono; aclaraciones mantienen IDs aun si se reordena catálogo. Correcciones explícitas pueden sustituir la consulta.
3. Corrección de bebida del combo: revierte únicamente una última adición registrada con firma de carrito intacta; conserva bebidas anteriores. Sin evidencia o con varios combos, aclarar. No deshacer compras históricas por adivinación.
4. Eliminación por fila/ordinal puede interrumpir checkout y conservar el dato pendiente. Si había snapshot viejo de Mercado Pago, se invalida como exigía el control histórico. No usar un número de otra lista como fila del carrito.
5. Última tanda: prefacio narrativo de grupo/lugar delimitado por dos puntos y etiquetas de destinatarios con nombre propio dejan de convertirse en productos ausentes; siguen avisándose productos ajenos al menú. Precio abreviado de familia identifica productos del carrito por palabras completas/plurales y cotiza todos si hay varios.
6. Disculpa de destinatario equivocado + compra nueva: se descarta propuesta sin confirmar y se procesa la compra del mismo mensaje. El texto original conserva la disculpa aunque el glosario la elimine; «otro combo» o «otra persona» no deben cancelar el pedido.

Archivos principales: `src/whatsapp/whatsapp-orchestrator.service.ts`, `whatsapp-session-intents.ts`, `whatsapp-dialogue-context.ts`, `types/whatsapp-session.types.ts`, `whatsapp-general-accuracy.spec.ts`. El orquestador sigue siendo grande y con caminos propios. No seguir sumando excepciones por nombres/IDs/precios PPP; usar catálogo/configuración y extraer responsabilidades gradualmente con regresiones.

## Evaluación real: qué pasó

Muestra sintética nueva con carta vegetal, `scripts/fixtures/whatsapp-independent-1410-cases.json`:

- Oficina:2 bowls,1 paquete trío,3 bebidas. Modelo correcto; backend inicialmente rechazó «somos varios en»/«oficina» y no resolvió «cuánto cuesta cada bowl». Corregido gratis y reensayado con modelo real: aprobado.
- Wrap: consulta de ingredientes sin comprar →2 wraps con salsa/dirección →total durante pago →transferencia. Aprobado al primer ensayo, sin ajustes para ese recorrido.
- Destinatario equivocado:pedido ajeno →«Uy perdón era otro negocio. Ahora sí quisiera una sopa de zapallo». Bloqueó con rechazo viejo; corregido gratis y reensayado real: aprobado.

Informes: `/tmp/ppp-independent-1410-model-report.json` (2 solicitudes, fallo), `/tmp/ppp-independent-1410-retest-report.json` (6, dos aprobados/un fallo), `/tmp/ppp-independent-1410-recovery-live-report.json` (3, reparación aprobada). La respuesta capturada de oficina está versionada en `scripts/fixtures/whatsapp-recorded-office-output.json`.

**Los3 casos ya se ejecutaron; oficina y recuperación se usaron para corregir. No llamarlos holdouts nuevos ni reutilizarlos como prueba de generalización.** Una muestra independiente pasó sin ajustes; esto no acredita cobertura global ni piloto autónomo.

## Prioridad nueva del usuario: consolidar comprensión

El usuario pidió dejar de avanzar mediante parches de frases. Tras la tanda local de cocina/cierre/listas, el siguiente trabajo principal es trazar desvíos y extraer un contrato común de intención/referencias/acciones/consultas, validar contra catálogo y aplicar cambios de sesión de forma coherente. El modelo ya propone acciones estructuradas: investigar reinterpretaciones posteriores antes de añadir otro parser. Migrar una familia acotada con comparación de recorridos, sin reescribir todo ni activar inferencia para cada turno sin medir costo/latencia. Las preguntas pendientes son contexto, no un bloqueo.

Los casos usados para corregir son regresiones, no medida de generalización; reservar conversaciones nuevas y catálogos distintos. Presupuesto agotado: continuar gratis. Ver la entrada «Cambio de prioridad pedido por el usuario: generalización» al final del historial.

## Familias pendientes para comprobar dentro de la consolidación

### 1. Cierre de compra dentro de un mensaje largo (primera tanda gratuita)

Observación real pendiente: «…Eso es todo por ahora, gracias» todavía responde ¿algo más? y queda building_cart sin pedir dirección. Crear primero baseline con router completo y comprobar respuesta/estado, no solo carrito.

Probar «eso es todo», «solo eso», «nada más» al final de compras de varios productos; mensajes con dirección y pago; mensajes con opciones aún pendientes; consulta hipotética («si pido…») que NO autoriza compra. Variar menús y usar cantidades/paquetes distintos. Si falta opción obligatoria, resolverla antes del checkout; si falta dirección, pedirla; si ya hay dirección/opciones, continuar a pago/confirmación según datos reales. No crear una orden ni interpretar cualquier aparición de «nada más» como autorización de compra.

### 2. Referencias entre listas, carrito y pago

Prioridad conocida: `pendingCompositionAsk` es una lista de consulta, pero el guard de filas históricamente contemplaba otras listas. Investigar «quita la2», «la segunda», «esa no» mientras hay consulta abierta y carrito diferente. No afirmar fallo hasta reproducirlo. Un número debe pertenecer a una elección identificada; si hay ambigüedad, pedir nombre sin mutar. Probar reordenamiento de catálogo, filas retiradas y preguntas durante elección.

### 3. Varios combos / varias líneas del mismo producto

Cambiar bebida/presa de uno y después otro; conservar notas, cantidades y bebidas compradas aparte. Reparto2 de una preparación/1 de otra, eliminación parcial y corrección posterior. Foco antiguo, oferta abandonada y cambio de familia no deben arrastrar producto equivocado. No restaurar snapshot si cambió carrito.

### 4. Contradicciones y recuperación

«Normal, pero sin…», «no esa, la otra», nota frente a extra pagado, desconocido mezclado con conocidos, rechazo de propuesta + nueva compra/consulta. Cortesía no es producto. Extras sin precio/disponibilidad configurados requieren aclaración o revisión humana, no gratuidad inventada.

### 5. Evaluación independiente y medios (sin API hasta autorización)

Preparar casos originales y congelar oráculos antes de ejecutar, distinguiendo desarrollo/reservados/reensayo. Cuando haya permiso, medir conversaciones completas con límite explícito de solicitudes, una repetición y stop-on-failure; guardar antes/después/respuesta/ruta/propuesta del modelo y uso. No gastar el saldo aislado ni repetir hasta obtener verde sin diagnosticar.

Audio: usuario no tiene originales guardados. Se detectaron compras de combo que conservaron bebida/dirección y perdieron producto padre. Texto transcrito solo prueba interpretación; no acredita mejora de Whisper. Fotos: usar archivo original y contexto para comparar, no captura de respuesta. No cambiar transcripción/visión sin evidencia y evaluación representativa.

Fuentes del usuario disponibles: `/home/levi/Downloads/chats 11_10.pdf` y `/home/levi/.codex/attachments/e387d2f2-9c09-43b2-9d1e-0bc7aa6603ad/Pasted text.txt`. Revisar patrones/fixtures existentes antes de duplicar casos. Sanitizar datos privados antes de versionar nuevos fixtures. Si se aplica skill PDF, leer su SKILL.md correspondiente.

## Ciclo local por tanda

1. Reproducir rojo con dependencias aisladas; incluir oráculos de carrito completo, cantidades, atributos/notas, dirección/nombre/teléfono/pago, estado, respuesta y ausencia de orden externa.
2. Probar PPP y cartas ficticias. Agente simulado activo/inactivo cuando corresponda. No confundir excepción por mock faltante con defecto de producción.
3. Cambiar una responsabilidad general. Mantener controles negativos/ambigüedad. No debilitar expectativas para aprobar; corregir un oráculo de redacción solo si conserva significado y datos verificables.
4. Ejecutar focalizadas y TypeScript. Luego global si se tocó regla compartida. Congelar todo `src/**/*.ts` durante global y comparar snapshot al finalizar; no atribuir verde a fuente editada mientras corría.
5. Global tarda actualmente13–16min. Esperar el footer y código de salida; proceso activo sin stdout no equivale a bloqueo. Dar actualizaciones concisas y no lanzar otra global igual sin cambios/fallos que lo justifiquen.
6. Documentar fallos, límites, resultados, fuente, commit y presupuesto; commit/push solo archivos pertinentes. Deploy staging si hay cambios de producto validados; no reconstruir por documentación sola.

Comandos gratuitos (no usar runner live por defecto):

```bash
npx jest src/whatsapp/whatsapp-general-accuracy.spec.ts --runInBand --silent -t 'NOMBRE DE LA TANDA'
npx tsc --noEmit --incremental false
npx jest --runInBand --silent > /tmp/ppp-next-full.log 2>&1
git diff --check
```

No regenerar dist/tsbuildinfo con compilación normal si no se necesita; respetar archivos ajenos. No repetir matriz MariaDB si no cambian esquema/transacciones. Captura de modelos: `scripts/whatsapp-live-router-rehearsal.ts` exige flag live/key, presupuesto compartido válido y límite; leerlo antes de usarlo. Actualmente el presupuesto impide nuevas inferencias.

## Deploy autorizado: solo staging

SSH con llave local: `root@76.13.119.125`; checkout `/opt/ppp-staging`, rama staging. Contenedor `ppp-staging-api-1`; candidate `ppp-nest-staging:candidate`; health `http://127.0.0.1:3301/api/health`.

```bash
ssh -o BatchMode=yes -o ConnectTimeout=15 root@76.13.119.125 'cd /opt/ppp-staging && test "$(git branch --show-current)" = staging && git fetch origin staging && git merge --ff-only origin/staging && docker compose --env-file .env.staging -p ppp-staging -f docker-compose.staging.yml up -d --build api'
```

Después verificar HEAD, contenedor running/healthy, imagen activa=candidate y HTTP/DB/circuit. Starting no es healthy; esperar y verificar de nuevo. No `--remove-orphans`, no borrar volúmenes ni tocar `mariadb_local`. No abrir env ni imprimir secretos. Checkout del servidor puede incorporar un commit solo de documentación sin reconstruir; distinguir HEAD del código en imagen.

Producción: `/var/www/ppp-nest`, container `ppp_nest_api`, puerto3000; conservar d9241abe. No tocar compose general ni reconstruir producción por continuar staging. No subir nada a Hostinger: esta tanda no modifica frontend.

## Puerta para piloto

Piloto supervisado pequeño, no venta autónoma certificada. Aceptar solo cuando preguntas no muten pedido/datos, correcciones se apliquen y retomen el paso pendiente, precios provengan de catálogo/cotización, ambigüedad no adivine y fallos críticos tengan contención humana. Falta evidencia de medios/canal y muestra independiente más amplia. Kamppo requiere además separación de catálogo/configuración y claves de sesión por tenant; menús ficticios no prueban aislamiento multitenant.

Primera acción del siguiente agente: comprobar checkout/HEAD, leer el último cierre verificado y presupuesto agotado; trazar gratuitamente una compra con atributos/notas y consulta intercalada para extraer el contrato común. El cierre largo tiene correcciones validadas y desplegadas en d1c7d8fc; no duplicar esos casos ni dar por probado el retorno tras varios turnos de opciones. No necesita gastar API ni preguntar nuevamente por rama.
