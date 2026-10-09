# PPP WhatsApp — ensayos aislados con OpenAI real

El comando prueba `WhatsappAgentService.runTurn` con una copia del menú suministrado. La suite `hard` aplica las acciones mediante **ActionGuard y el método real `WhatsappOrchestratorService.applyActions`**, sin construir el servidor, repositorios de BD, transportes Meta ni servicios de pedidos/pagos. Configuración de ensayo: negocio abierto, límites y domicilio sin configurar. No usar estos precios/datos como fuente de producción.

## Ejecutar

La clave se toma de una variable privada o del secret de GitHub Actions. No copiarla al código, chat ni informes. El script exige `WHATSAPP_BETA_LIVE=1` y `OPENAI_API_KEY` antes de llamar a OpenAI.

```bash
# 30 conversaciones difíciles originales
WHATSAPP_BETA_LIVE=1 WHATSAPP_BETA_SUITE=hard WHATSAPP_BETA_CASE_LIMIT=30 yarn beta:whatsapp:ai

# 29 conversaciones nuevas, repetidas dos veces: cantidades, notas, variantes y correcciones
WHATSAPP_BETA_LIVE=1 WHATSAPP_BETA_SUITE=hard WHATSAPP_BETA_CASE_OFFSET=30 WHATSAPP_BETA_CASE_LIMIT=29 WHATSAPP_BETA_REPEATS=2 yarn beta:whatsapp:ai

# 32 conversaciones cotidianas adicionales, repetidas dos veces
WHATSAPP_BETA_LIVE=1 WHATSAPP_BETA_SUITE=hard WHATSAPP_BETA_CASE_OFFSET=59 WHATSAPP_BETA_CASE_LIMIT=32 WHATSAPP_BETA_REPEATS=2 yarn beta:whatsapp:ai
```

Modelo predeterminado: `gpt-4o-mini`; `WHATSAPP_BETA_MODEL` permite especificar otro. Dos repeticiones ayudan a detectar variación; no garantizan robustez general.

## Comprobaciones

- IDs y cantidades finales; exclusión de productos ajenos; no duplicar artículos al recibir notas/dirección.
- Valores de atributos del catálogo, elección explícita y primera opción para los omitidos.
- Notas por plato y variantes del mismo SKU en líneas independientes.
- Ausencia de acciones prohibidas, intención de la respuesta y límite de longitud.
- Copias independientes del carrito en cada turno, evitando alterar retrospectivamente el historial del informe.
- Carritos intermedios esperados: preguntar disponibilidad/precio no añade productos, y una dirección posterior no cambia las cantidades.
- Una suite vacía o un caso rechazado devuelve código de error. Actions verifica todos los grupos informativos y difíciles, incluidas las repeticiones.

Informes sintéticos: `tmp/whatsapp-beta-ai-report.json`, artefactos separados por grupo y detalles de los rechazos en los logs. No subir al repositorio informes con chats reales, datos personales o credenciales.

Cada invocación registra `apiUsage` en el informe y una línea `API_USAGE_SUMMARY` en los logs: solicitudes API, respuestas con uso disponible, tokens de entrada, entrada en caché, salida y errores HTTP. El contador observa copias de las respuestas únicamente en el proceso de ensayo; no cambia AgentV1 ni registra claves.

Para `gpt-4o-mini` y su snapshot de julio de 2024 estima costo de los tokens reportados con precios estándar verificados el 9 de octubre de 2026: USD 0.15/1M entrada sin caché, USD 0.075/1M entrada en caché y USD 0.60/1M salida ([fuente oficial](https://developers.openai.com/api/docs/models/gpt-4o-mini)). No aplica esos precios a otros modelos. El estimado no es una factura; no incluye impuestos, otros servicios ni ajustes de la cuenta. `usageComplete=false` indica respuestas exitosas sin uso válido; no interpretarlas como costo cero.

Sumar las líneas de los cinco jobs y de todas las invocaciones dentro de `beta-tests` para medir una ronda completa; no sumar de nuevo artefactos que contienen esos mismos datos. Un ensayo puede tener varios mensajes y cada turno hasta seis llamadas de modelo. Los 303 ensayos configurados no equivalen a 303 llamadas API ni a 303 pedidos comerciales. Los costos de las suites locales y MariaDB no usan la API OpenAI.

## Límites del ensayo

La suite `hard` cubre interpretación, sanitización y aplicación real de acciones al carrito **en memoria**. No ejecuta `handleIncoming`, el enrutamiento completo, persistencia, concurrencia distribuida, inventario, cobertura/tarifa real, cocina, pagos ni creación/confirmación de órdenes. Los seis casos básicos y los 33 informativos siguen aislados en AgentV1. Validar el recorrido completo en staging con BD y transportes aislados antes de desplegar.

Las pruebas en `whatsapp-cart-integration.spec.ts` y `whatsapp-cart-edits.spec.ts` verifican además la aplicación real de correcciones, opciones y notas sin OpenAI. `yarn test:whatsapp` incluye estas pruebas y las de lenguaje con el catálogo suministrado.

La suite difícil contiene 147 escenarios distintos. El workflow ejecuta 303 conversaciones en total: seis básicas, 33 informativas, 30 difíciles originales, 29 de seguimiento repetidas dos veces, 32 cotidianas repetidas dos veces, 48 de edición repetidas dos veces y ocho patrones de chats reales convertidos en casos sintéticos repetidos dos veces. Los grupos nuevos cubren ejecutivos con sopas distintas, bebidas de combos independientes, consultas antes de comprar, cantidad total frente a adicional, número de personas frente a códigos, notas de empaque, retiro/cambio de productos y cifras de billete/dirección que no son unidades.

La primera ejecución de los casos cotidianos aceptó 49/64; encontró errores en cantidades y selección de opciones que se corrigieron en catálogo, AgentV1, ActionGuard y aplicación del carrito. Una repetición del grupo original también descubrió que “medio pollo” podía añadirse como frito sin elegir preparación; `add_item` ahora rechaza esa elección arbitraria. Conservar los escenarios y sus expectativas originales permite comprobar estas correcciones en cada ejecución.

El 9 de octubre de 2026, la ejecución [37881167159](https://github.com/wilmerx5/PPP-NEST/actions/runs/37881167159) pasó los 191 ensayos en el commit `ef039b46b768c095966573310cc16dcaa3cc6a78`. Incluye la regresión de «¿Se puede pedir un jugo en leche?»: consultar esa posibilidad no añade el jugo. Es evidencia del conjunto probado, no del circuito completo de staging.

## Edición por línea y patrones de chats

```bash
# 48 casos de edición, dos repeticiones
WHATSAPP_BETA_LIVE=1 WHATSAPP_BETA_SUITE=hard WHATSAPP_BETA_CASE_OFFSET=91 WHATSAPP_BETA_CASE_LIMIT=48 WHATSAPP_BETA_REPEATS=2 yarn beta:whatsapp:ai

# 8 patrones de chats PPP, con textos e identificadores sintéticos
WHATSAPP_BETA_LIVE=1 WHATSAPP_BETA_SUITE=hard WHATSAPP_BETA_CASE_OFFSET=139 WHATSAPP_BETA_CASE_LIMIT=8 WHATSAPP_BETA_REPEATS=2 yarn beta:whatsapp:ai
```

`get_cart` proyecta las acciones aceptadas del turno, conservando índices estables incluso para líneas nuevas. `update_item` cambia cantidad absoluta o nota completa; una nota vacía la elimina. `remove_item` retira una línea y `set_attribute` cambia una opción de esa línea. `replace_item` valida el SKU nuevo antes de retirar el anterior; dentro del mismo SKU conserva las demás variantes. Las ediciones deben respetar límites y conservar todas las unidades al unir variantes idénticas.

La primera ejecución de los 48 casos de edición aceptó 44/96 repeticiones. Las regresiones detectaron pérdida de variantes, notas generales en lugar de notas de línea, control de cantidades mezclado con palabras de platos y sustituciones equivocadas. Una ejecución posterior pasó 95/96; repetir los mismos casos descubrió además inconsistencias dentro del turno y preparación escrita como nota. Registrar los resultados de cada SHA; no usar un grupo verde de un commit anterior como aceptación del commit final.

Estos ocho casos adicionales derivan de patrones observados en los chats compartidos: faltante y cantidad total en una frase; preguntar qué incluye un pedido existente; typo de preparación dentro de un combo; bebida incluida; cambio de dirección con números; negación de retiro; atributo más nota de empaque; consulta de un producto inexistente conservando el carrito. No se incluyen datos personales ni precios de los chats históricos.

## Estado de revalidación — 9 de octubre de 2026

La ejecución [37887612562](https://github.com/wilmerx5/PPP-NEST/actions/runs/37887612562), en `cc388ee4`, reprodujo fallos adicionales: proteger un producto distinto al retirar otro, omitir la milanesa mientras se corrige otra cantidad, descomponer un combo, perder una nota, atributos mal formados y contestar disponibilidad sin consultar el catálogo. Se añadieron regresiones y correcciones por cláusula, opciones del catálogo y validación de herramientas.

En el código `aac59934d8ed99249097d646eb03e259eb70b78a`, [Nest CI](https://github.com/wilmerx5/PPP-NEST/actions/runs/37888418887) pasó compilación y 650 unitarias, incluidas las nuevas regresiones. La revalidación con OpenAI [37888415744](https://github.com/wilmerx5/PPP-NEST/actions/runs/37888415744) quedó **bloqueada**: HTTP 429, `insufficient_quota`, código `credit_balance_exhausted`. El proveedor indica que la cuenta no tiene créditos restantes. Esto no demuestra que las correcciones conversacionales pasen ni sustituye las expectativas originales.

Tras restaurar saldo en la cuenta de la clave `OPENAI_API_KEY`, ejecutar el workflow completo para los 303 ensayos configurados, con los cinco jobs. Mantener la PR en borrador hasta revisar esa ejecución y la aceptación externa. Las pruebas MariaDB usan acciones sintéticas; su resultado verde no certifica interpretación por el modelo.

## Revalidación después de recargar créditos

En `ce0d495`, la ronda [37889757623](https://github.com/wilmerx5/PPP-NEST/actions/runs/37889757623) completó 303 ejecuciones: 299 aceptadas y 4 fallos, correspondientes a tres patrones. Cambiar dos atributos del combo intentó reemplazar su SKU (dos repeticiones); dos llamadas de sopa reutilizaron la cantidad escrita y sumaron cuatro en vez de dos; una nota parcial omitió «más yuca». Se agregan regresiones que comparan acciones y carrito real, conservando las expectativas de la suite. Las correcciones deben validarse de nuevo con IA antes de aprobar producción.

El medidor de esta ronda informó 760 solicitudes y estimación total US$0,4103997 por tokens de texto reportados, con uso completo. No permite reconstruir cargos previos ni medir aún el costo comercial por pedido.

La ronda [37890713475](https://github.com/wilmerx5/PPP-NEST/actions/runs/37890713475), en `204cc7a`, aceptó 302/303: todos los casos anteriores quedaron aprobados, pero una edición posterior de `update_item` borró la sustitución papas → yuca. El separador de búsqueda había eliminado el texto de modificación del segmento original. La siguiente corrección conserva ese texto y la sustitución al editar una línea recién agregada; además suma cantidades de platos idénticos escritos en cláusulas independientes. Ocho regresiones nuevas y 662 unitarias pasan localmente; la nueva ronda con IA sigue siendo necesaria.
