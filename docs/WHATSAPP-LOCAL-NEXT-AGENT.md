# Continuación local de PPP WhatsApp

## Tanda vigente: reemplazo de modelo (15/10)

**Sol (`gpt-6.1-sol`) elegido para validación de calidad en staging.** Código integrado y validado: **74 suites / 5.562 pruebas aprobadas**,40 más que a1bcfd0f (incluye cambios locales previos conservados),851.419s. TypeScript aprobado. Snapshot src/scripts intacto; global definitiva `/tmp/ppp-model-integration-final-full.log`, snapshot `/tmp/ppp-model-integration-source.json`, TypeScript `/tmp/ppp-model-integration-tsc.log`. Una global anterior fue interrumpida para corregir render; no cuenta como aprobada.

Transporte Responses para GPT-6, compatibilidad anterior conservada, rollback por WHATSAPP_AGENT_MODEL. Sol pasó dos conversaciones completas de3turnos con PPP+yotra carta, tokens reportados USD0.025812 y USD0.0325505. No son holdouts ni un ranking estadístico. Luna propuso carrito/respuesta correctos; el backend descartó formulaciones de indisponibilidad. Ver [comparación y plan](WHATSAPP-MODEL-COMPARISON.md) y `whatsapp-model-comparison-1510.json`. Se corrigieron guardia de bebida incluida, preámbulo de precio y render; no excepciones de platos en producción.

Presupuesto actual:119top operativo/115intentos usados/4restantes;38intentos en la tanda, uno antes de red por preparación defectuosa. Suma sobre tokens reportados USD0.125462, no factura. Registro y espejo sincronizados. No confundir estos topes elegidos por agente con cifras del usuario. No Meta/pagos/mapas/órdenes externos; solo inferencia real y router aislado.

**Sol activo en staging, código fd4c2f0c**, verificado 2026-10-15T17:35:34.124427+00:00: running/healthy, imagen coincide con candidate, healthHTTP200/DBconnected y WHATSAPP_AGENT_MODEL=gpt-6.1-sol. Main intacta. Visión todavía usa ajuste compartido gpt-4.1; voz runtime whisper-1. Retirada de GPT-4.1 NO queda completamente resuelta hasta migrar visión/clasificación. Latencia inicial Sol14.9–17.7s en los recorridos aprobados, mejora pendiente.

Próximo: fuente idéntica por candidato, más conversaciones no inspeccionadas, contrato estructurado de ausentes (render regex solo intermedio), compra simple de paquete con condición capturada como pregunta, reducir rondas/latencia, evaluar medios por separado. No declarar vendible por tests verdes ni que Sol es superior a Luna por fallos del backend.

## Historial anterior

Estado local actualizado al 15/10/2026. Última verificación del runtime:14/10/2026,22:34Bogotá. Este es el punto de entrada breve; el historial completo está en `AGENT-HANDOFF-WHATSAPP.md`. Las secciones antiguas de ese historial no representan el presupuesto ni el despliegue actual.

## Tanda actual: recuperación técnica y compras condicionales (base 931c6a4e)

Bloque validado: **70 suites / 5.522 pruebas aprobadas**,31regresiones nuevas frente a931c6a4e,en486.72s. Fuente intacta y TypeScript sin errores. Publicado solo en rama staging,sin deploy ni cambios aMain. Evidencia: `/tmp/ppp-technical-mixed-approved-full.log`. TypeScript: `/tmp/ppp-technical-mixed-approved-final-tsc.log`; snapshot de src/scripts TS: `/tmp/ppp-technical-mixed-approved-source.json`. Snapshot comparado e idéntico al finalizar. No deploy ni Main.

Cambios comprobados focalmente:

- Si una acción modificó el carrito y después falló la respuesta del proveedor, mostrar el carrito aplicado y pedir revisión. Se prueba timeout sostenido con sus tres reintentos, HTTP500, mensaje inexistente y contenido vacío. La respuesta no debe pedir repetir un cambio ya aplicado ni confirmar una orden externa.
- Un lote con compras aceptadas y otros SKUs rechazados conserva las aceptadas. El rechazo no se interpreta como producto olvidado ni se reconstruye desde el parser viejo. Se muestra qué fragmento no se añadió. No demuestra completitud del mensaje entero; el seguimiento de rechazos por ID todavía no distingue una variante rechazada y otra aceptada del mismo SKU.
- La ruta rápida de multi-producto comprobará modificadores explícitos en fichas con descripción de receta usando la misma validación que add_item. Las fichas sin descripción conservan la ruta anterior: ausencia de metadatos no demuestra ausencia de ingrediente. La descripción también cuenta como receta confirmada. Sustituciones registradas conservan su propio contrato. Falta ampliar ingredientes sin «con» y aclaraciones posteriores.
- Una compra con condición de inventario pasa al agente antes del parser de varios platos, solo en building_cart, con agente activo y sin pendientes. El texto entero llega al modelo. Una consulta o un «sí» aislado no activan esta ruta; si no se resuelve, no se consume parcialmente mediante el atajo viejo. No se ha migrado todo el router a un único intérprete.

Modelo real: fixture nuevo `whatsapp-mixed-followup-1510.json` falló antes del modelo (0requests): omitió bowl y trató instrucciones como platos ausentes. Tras diagnóstico y regresión gratuita pasó los 3turnos con gpt-4.1-2025-04-14 en 3requests:wrap Yogur+bowl,ausencia brownie,cambio a Tahini+sin cebolla solo wrap,total33.600. Es reensayo de desarrollo, no holdout. Informe `/tmp/ppp-fresh-mixed-correction-retest-live.json`; captura sintética versionada `whatsapp-recorded-conditional-correction-output.json`. Fallos técnicos se simularon gratis; no se provocaron errores pagados artificialmente. No acredita WhatsApp/voz/fotos reales.

La primera global falló4regresiones (5518/5522pasaron,854.863s):se habían tratado fichas sin descripción como recetas completas. Se corrigió la frontera por disponibilidad de datos y se mantienen los4oráculos originales.35focalizadas en3suites aprobadas tras reparación;global definitiva aprobada5522/5522. No usar la global fallida como aprobación. El modelo se ensayó antes de este último ajuste de fichas sin descripción;su carta sí tenía descripciones.

Presupuesto actual: topes elegidos por agente bajo autorización continuada del usuario,80acumuladas/77usadas/3restantes. Esta tanda gastó3requests;0el fallo inicial determinista. Registro y espejo sincronizados. No atribuir al usuario un límite numérico que no expresó.

Próximo: identidad por línea para rechazos de variantes del mismo SKU;aclaración persistente de la línea no añadida;API401 tras acción aceptada (su fallback anterior sigue distinto);más mensajes no inspeccionados;replay de chats reales y piloto supervisado. Mantener abiertos esos límites aunque la global pase.

## Historial de tandas anteriores

## Tanda vigente (15/10): destinatarios, línea normal y paquetes

Base647a3739. Usuario autorizó más inferencia y recargó saldo tras HTTP429. Tanda operativa elegida por el agente:15requests adicionales;14consumidas (incluye1rechazada por saldo),1restante;acumulado75/74/1. No es límite numérico dictado por el usuario ni autorización permanente. Contadores y espejo privados sincronizados.

Tres conversaciones completas pasaron con gpt-4.1-2025-04-14 en simulador de router aislado:mixto+productoausente+notadirigida (5requests);sopa normal+misma sopa sincilantro+tercerplato+total37.100 (retest2);trío1+dosbebidas sinazúcar→tresen total (4). El primer intento independiente de destinatarios falló con2requests:modelo propuso las3líneas bien,backend rechazó bowl al tratar «para cada uno…»/«a la de [persona]…» como dirección. Corregido gratis y reensayado. Paquetes no cuenta como holdout:tuvo pruebas gratuitas antes de la llamada exitosa. Capturas sintéticas versionadas scripts/fixtures/whatsapp-recorded-recipient-pack-output.json;ninguno acredita audios/fotos ni transporte WhatsApp real.

Cambios:reparto de comensales no se guarda como dirección;«a la de…»/«en la de…» son referencias anafóricas;línea normal+gemelo connota distinta pueden preservar lote validado (duplicados idénticos siguen rechazados);cantidad literal unida al nombre completo se lee antes de limpieza para búsqueda,después del cálculo de comensales;duo/trio abreviados conservan tamaño de paquete y aclaran si variosSKUs coinciden. Sin nombres/IDs/precios PPP codificados en producción.

Pruebas focalizadas:132contratos en5suites;38focalizadas en3suites y4controles de ambigüedad. Cierre validado:70suites/5491tests en490.707s,28regresiones nuevas frente a647a3739. Global /tmp/ppp-recipient-pack-full.log,snapshot src+scripts /tmp/ppp-recipient-pack-source.json intacto,TypeScript /tmp/ppp-recipient-pack-final-tsc.log sin errores. Publicado solo en rama staging;no deploy/Main.

Próximo bloque:recuperación tras fallo técnico después de tools aceptadas;mensajes con aceptados/rechazados y completitud total;más destinatarios/pronombres y correcciones que cambian una de varias líneas iguales. Antes de piloto:replay de chats reales sin mutaciones inesperadas,ensayos nuevos no inspeccionados con catálogo PPP+yotro,familias de interrupciones en cada estado, y muestra supervisada en WhatsApp. Mantener todos los hallazgos rojos abiertos aunque la global pase. Voz real sigue pendiente de audios originales;no pedir al usuario repetir casos que ya entregó ni afirmar que transcripción mide voz.

## Historial anterior (supeditado a la tanda vigente)

## Último bloque local (15/10): reparto y lote aceptado

El caso narrativo ya pasa completo con modelo real:2bowls+wrapTahini+wrapYogur y consulta total67.200.4requests en ese bloque. Presupuesto actual:60usadas/0restantes tras el reensayo mixto posterior. Es reensayo de desarrollo del caso conocido,no holdout nuevo. También pasa gratis con otra carta ficticia y notas separadas. Se conserva un lote íntegramente aceptado por herramientas sin volver a interpretar cantidades/opciones en reconciliación/planner. Se mantienen catálogo,límites y legacy para lotes mixtos/duplicados/notas sin distinta opción. Ver límites al final del handoff largo.

La primera global falló y su fuente cambió por ediciones concurrentes;no usarla como validación. El usuario confirmó que terminó de editar y autorizó integrar. Global definitiva aprobada70suites/5456tests en476.716s (/tmp/ppp-integrated-approved-full.log),snapshot src+scripts /tmp/ppp-integrated-approved-source.json intacto.146focalizadas+77router+82contratos y TypeScript aprobados. TypeScript aprobado. Source congelada,sin deploy ni cambios a Main. Próximo paso:completitud del mensaje entero,productos ausentes y lotes mixtos;repartos con pronombres y notas distintas de mismoSKU sin variar atributos. No reabrir el caso oficina como si siguiera rechazado ni reducir sus oráculos. Captura real sintética versionada:whatsapp-recorded-distributed-output.json.

## Seguimiento mixto (15/10, validado)

Base integrada y publicada81b4fd13. unavailableAskReply ahora respeta isAvailabilityInquiry del mensaje entero:una condición «si no hay brownie» dentro de una compra no intercepta los platos disponibles.7regresiones gratuitas aprobadas y84contratos de catálogo/lenguaje. Reensayo real4requests:primer turno completo correcto;segundo update_item apunta solo al wrap y carrito correcto,pero el límite corta la respuesta final. NO aprobar conversación completa por ese resultado. Informe /tmp/ppp-mixed-conditional-live-report.json. Presupuesto agotado60/60;no inferencias nuevas sin autorización. Global aprobada:70suites/5463tests en469.355s;TypeScript aprobado y snapshot src+scripts intacto. Evidencia /tmp/ppp-mixed-conditional-full.log y /tmp/ppp-mixed-conditional-source.json. Corrección publicada solo en staging,sin deploy/Main.

Próximo orden:1reparto con una línea normal y otra con nota;2paquetes frente a cantidades absolutas;3rechazos mezclados y completitud de todo el mensaje;4recuperación ante fallo del proveedor después de una herramienta aceptada. Para cada familia:catálogo PPP+ficticio,estado/carrito/respuesta y controles negativos. Voz real pendiente por falta de audios originales;texto transcrito no acredita detección de audio. No deploy/Main.

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

## Presupuesto vigente

**60 autorizadas / 56 usadas / 4 restantes.** Extensión del usuario vigente; detener ante fallo y diagnosticar gratis antes de reensayar. No resetear contadores al cambiar agente o proceso.

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

Los casos usados para corregir son regresiones, no medida de generalización; reservar conversaciones nuevas y catálogos distintos. Saldo vigente arriba; el último fallo nuevo debe diagnosticarse gratis antes de reensayar. Ver la entrada «Cambio de prioridad pedido por el usuario: generalización» al final del historial.

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

No regenerar dist/tsbuildinfo con compilación normal si no se necesita; respetar archivos ajenos. No repetir matriz MariaDB si no cambian esquema/transacciones. Captura de modelos: `scripts/whatsapp-live-router-rehearsal.ts` exige flag live/key, presupuesto compartido válido y límite; leerlo antes de usarlo. El presupuesto compartido impide superar el saldo vigente.

## Deploy autorizado: solo staging

SSH con llave local: `root@76.13.119.125`; checkout `/opt/ppp-staging`, rama staging. Contenedor `ppp-staging-api-1`; candidate `ppp-nest-staging:candidate`; health `http://127.0.0.1:3301/api/health`.

```bash
ssh -o BatchMode=yes -o ConnectTimeout=15 root@76.13.119.125 'cd /opt/ppp-staging && test "$(git branch --show-current)" = staging && git fetch origin staging && git merge --ff-only origin/staging && docker compose --env-file .env.staging -p ppp-staging -f docker-compose.staging.yml up -d --build api'
```

Después verificar HEAD, contenedor running/healthy, imagen activa=candidate y HTTP/DB/circuit. Starting no es healthy; esperar y verificar de nuevo. No `--remove-orphans`, no borrar volúmenes ni tocar `mariadb_local`. No abrir env ni imprimir secretos. Checkout del servidor puede incorporar un commit solo de documentación sin reconstruir; distinguir HEAD del código en imagen.

Producción: `/var/www/ppp-nest`, container `ppp_nest_api`, puerto3000; conservar d9241abe. No tocar compose general ni reconstruir producción por continuar staging. No subir nada a Hostinger: esta tanda no modifica frontend.

## Puerta para piloto

Piloto supervisado pequeño, no venta autónoma certificada. Aceptar solo cuando preguntas no muten pedido/datos, correcciones se apliquen y retomen el paso pendiente, precios provengan de catálogo/cotización, ambigüedad no adivine y fallos críticos tengan contención humana. Falta evidencia de medios/canal y muestra independiente más amplia. Kamppo requiere además separación de catálogo/configuración y claves de sesión por tenant; menús ficticios no prueban aislamiento multitenant.

Primera acción del siguiente agente: comprobar checkout/HEAD, leer el último cierre verificado y presupuesto vigente; reproducir gratis el fallo de validación por línea de la última evaluación narrativo/oficina. La primera extracción de contrato ya está en6daf557b. El cierre largo tiene correcciones validadas y desplegadas en d1c7d8fc; no duplicar esos casos ni dar por probado el retorno tras varios turnos de opciones. No necesita gastar API ni preguntar nuevamente por rama.


## Última evaluación local (prioridad vigente)

Base6daf557b,contrato local69suites/5372tests aprobado antes de ajuste de referencia de bebida. El ajuste y10regresiones aprobaron69suites/5382tests en806.44s;fuente src+scripts intacta.14focalizadas y TypeScript aprobados;log /tmp/ppp-price-class-full.log. No se despliega.

Nuevo caso narrativo de oficina en scripts/fixtures/whatsapp-contract-independent-office-1410.json falló:2bowls+doswraps con salsas distintas quedan1bowl+1wrap. Dos llamadas pagadas;saldo52/60usadas,8restantes. Reproducción gratuita demuestra que add_item rechaza acciones correctas por palabras gramáticas «cada»/«pero». Los argumentos reales del modelo no se capturaron;no atribuirle una propuesta correcta sin prueba. El fallback también pierde cantidades/variantes. Prioridad:contrato de evidencia por línea y contención de fallback;no seguir gastando ni sumando frases al azar. Ver diagnóstico y límites al final de AGENT-HANDOFF-WHATSAPP.md. Referencia de bebida corregida es un bloque distinto;no afirmar que arregla este pedido narrativo.


### Criterios del próximo bloque (antes de más API)

1. Reproducir gratis el fixture narrativo completo con propuesta estructurada conocida, tool add_item y router. Exigir2bowls,1wrapTahini,1wrapYogur;notas y atributos por fila;no añadir bebidas negadas. No basta assert de IDs agregados.
2. Definir evidencia por línea:fragmento del mensaje original,SKU autorizado,cantidad y opciones propuestas. No aceptar fragmentos inventados ni usar la selección de un fragmento para eludir una pregunta/no-compra o un ingrediente realmente ajeno al plato.
3. Separar tres resultados de validación:aceptado,ambiguo/no respaldado,rechazado por contradicción explícita de catálogo. Una palabra gramatical sobrante no es evidencia de un producto inexistente. No resolver incertidumbre sumando una compra parcial sin avisar.
4. Pruebas negativas:arroz con mariscos cuando no existe;combo frente a sus componentes;negación de bebida;dos variantes del mismoSKU;producto realmente inexistente entre otros válidos;consulta de precio/ingredientes sin compra;opción no permitida;contradicción de cantidades. Usar más de una carta ficticia.
5. Respuesta derivada del resultado aplicado:si faltan líneas,explicar cuál falta y conservar pedido previo;si hay opciones distintas,no fusionarlas;si no hubo aplicación,no afirmar añadido. Distinguir faltantes del pedido nuevo de filas preexistentes.
6. Congelar fuente y aprobar focalizadas,TypeScript/global antes de repetir modelo. Reensayo del caso ya visto es regresión;reservar otro caso nuevo independiente. Máximo8solicitudes restantes y detener primer fallo. No desplegar hasta entrega acumulada explícita.


## Bloque posterior: resultados de herramientas y contención

Nueva entrega local después de66be665a:purchaseAttempts distingue intento rechazado/aceptado sin PII. Si todos los add_item fallan y no hay adiciones aceptadas,el router conserva carrito y pide aclaración;ya no reconstruye el pedido erróneo por fallback. Un intento posterior exitoso sigue permitido. Runner sintético captura argumentos/resultados por turno y distingue model_call de validation_probe.15focalizadas y TypeScript aprobados;global definitiva70suites/5397tests aprobada en795.382s (/tmp/ppp-rejected-tools-approved-full.log),snapshot src+scripts intacto. La primera global se interrumpió por ajuste de prioridades y no se cuenta como resultado. Atención humana validada y consultas de pedido/ETA tienen prioridad;conservan carrito preexistente. Sin requests nuevas,saldo8,sin deploy. Ver límites de casos mixtos y próxima evidencia por línea al final del handoff largo. El pedido narrativo NO está aprobado como compra completa;no reducir su oráculo.

Último cierre local:contención y trazas validadas70/5397,sin deploy y sin nueva API. Empezar por la validación de evidencia por línea pendiente,conservar el oráculo completo del fixture de oficina y usar diagnóstico gratuito antes de las8solicitudes restantes.

Las entradas previas de contención/rechazo de oficina describen el estado anterior. El bloque15/10 de arriba y el final del handoff largo los sustituyen para la prioridad y el presupuesto vigentes.

Integración15/10:conservar nuevas familias de notas distintas/dirección que mantiene paso pendiente. Se corrigieron herencia de cantidad en reemplazos y opciones dadas como nota;dobles de pruebas actualizados. Fuente congelada para global definitiva. Consultar el cierre más reciente del handoff largo antes de publicar;56/60usadas,4restantes,sin deploy.

Punto validado15/10:70/5456,59pruebas nuevas incluyendo integración ajena.149contratos+32router+TypeScript aprobados. Nuevo caso mixto falló antes del modelo0requests porque unavailableAskReply ignoraba isAvailabilityInquiry=false. Es el siguiente bloque;ver evidencia al final del handoff. No declarar que todo el agente está cerrado ni contar fixture nuevo como aprobado.
