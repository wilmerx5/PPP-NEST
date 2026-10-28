# Tandas256–257: reparto por unidad y compra nueva en audios reales

Base local255 `411fcafe` (validada20.675/324, aún sin publicar/desplegar); servidor staging254. Continúa los tres audios aportados por el usuario durante la validación255. Fuente: archivos privados en Downloads, contrastados por SHA-256 contra los hashes de los webhooks y las transcripciones reales guardadas en staging. Los tres archivos coinciden exactamente. No se copian binarios ni datos personales al repositorio, ni se realizó inferencia nueva.

## Hallazgos

1. El audio de13:05:38 se transcribió con dos ejecutivos, presas y bebidas diferentes y Ajiaco común. La respuesta agregaba dos ejecutivos Broaster idénticos. No se había elegido Broaster/Frito explícitamente.
2. El de13:06:25 pedía un pollo frito en combo. Con los ejecutivos en carrito se interpretaba como cambio de preparación de ambos, conservando cantidad dos.
3. Tras reiniciar, el de13:07:20 se transcribió «de combo ... y con las arepas fritas». Añadía gaseosa400ml independiente, nota de arepas en ella y también el combo. No era una bebida antigua que hubiera que eliminar.

Estos defectos están después de la transcripción. Eso no acredita precisión perfecta del modelo de audio ni una comparación Luna/Sol. Se usan texto real guardado y entrada de audio con descarga/transcripción simuladas para aislar el procesamiento posterior. No se ha evaluado nuevamente el reconocimiento acústico.

## Corrección

256 conserva un plan completo de atributos para cada unidad mientras se elige la preparación del producto. Reconoce cláusulas acotadas «uno con», «el otro con», «los dos con», incluso repetidas para atributos diferentes; resuelve opciones por catálogo y rechaza contradicciones/notas no representables. Dos unidades con opciones completas se conservan en `pendingMatch.unitAttributeGroups`, sin compra hasta elegir una variante. La respuesta recuerda ambos conjuntos y pide elegir la preparación para las dos. La elección valida disponibilidad/opciones/precio y agrega una unidad por conjunto como una operación completa. No confirma desde otra ruta/herramienta mientras falta esa elección, incluso con carrito vacío o `skipFinalConfirm`. Negación, consulta o pedido de otro combo no se consume como una preparación.

257 lleva la compra explícita de un combo con variante nombrada antes de las correcciones guiadas por el carrito. «Quiero un...» compra una unidad nueva y conserva los ejecutivos; no se convierte en reemplazo de ambos. La forma acotada «de combo» se interpreta como «en combo» dentro de este pedido, conservando opciones incluidas. No añade ni cobra una bebida suelta por el mismo texto, ni mueve una nota de arepas a una bebida. Las bebidas que ya estaban compradas se conservan; no se retiran productos por suposición.

Las reglas no tienen nombres/IDs/precios PPP como excepciones de producción. Se comprueba con tres familias sintéticas y sus catálogos. No se cambian prompts, modelos ni dependencias.

## Validación y límites

Baseline de las tres secuencias sobre255:12/12 rojas, texto/audio simulado × agente off/on. Primer arreglo8/12 verdes; la variante «de combo» seguía duplicando bebida y se corrigió usando la normalización acotada. Controles de desarrollo tuvieron errores de tipado de fixture/union, corregidos antes del foco final; no se cuentan como fallos de producto ni aprobación. Foco final354/354 en8suites.

88 casos nuevos:12 de las tres secuencias reales por texto/audio y agente off/on;66 en tres familias × off/on × once caminos (válido, opción desconocida, contradicción, interrupción/negación, retirado, opción retirada, precio cambiado, cerrado, límite, selección competidora, confirmación interna);6 bebidas preexistentes conservadas y2 de acompañamiento/destinatario y2 de empaque sin cambio de identidad. Los recorridos aprobados comprueban respuesta, carrito, opciones por dueño y DTO final; los bloqueados comprueban conservación completa y ausencia de orden. Meta, transcripción, modelo, mapas, persistencia y creación de órdenes se simulan. Global final del conjunto255–257 en `whatsapp-batch-256-257-validation.json`.

Contrato acotado: dos unidades de una familia con variantes, atributos completos de catálogo, una preparación común elegida para ambas. No resuelve todos los repartos mixtos entre SKUs, tres o más unidades, notas compuestas, nuevas compras durante una selección pendiente ni el compuesto histórico con «colombina» fuera de catálogo. Si falta información se pide aclaración, no se da por completo el corpus de chats/PDF. Continúan pendientes08/28, evaluación independiente de modelos/medios/canal y piloto.

Nuevo campo opcional dentro del JSON de sesión, sin migración de esquema. Una imagen anterior no conoce ese plan y podría perderlo al elegir; antes de rollback de staging, cancelar/reiniciar los borradores de prueba afectados, sin borrar datos de clientes. Mantener env/compose/modelos/bases/volúmenes y archivos privados. Main/producción244 sin cambios; presupuesto267/256/11 y espejo intactos.

La primera global256 detectó2regresiones del caso antiguo de acompañamiento/destinatario. La compra se adelantó después de extraer el destinatario y pasó la nota de cocina al manejador común de atributos. Las expectativas históricas no se cambiaron; se añadieron2controles estrictos. El bloque fallido se excluye y el inventario completo se repite sobre la fuente final.

Antes de la validación final se cerró el uso de cantidades previas en la compra explícita y se añadió la comprobación de horario al consumir el plan pendiente. Las pasadas intermedias interrumpidas o de fuente anterior no cuentan como aprobación. Los controles incluyen la pista anterior de dos pollos y el cierre del local después de abrir la selección.

Un bloque de desarrollo posterior detectó2regresiones de empaque: la familia elegía medio pollo cuando se nombraba dentro de una nota de caja. El atajo exige ahora que el candidato sea un combo y deja esa nota al manejador existente. Las expectativas históricas permanecen intactas; se añaden2controles. Esa ejecución tampoco se cuenta como aprobación.

## Despliegue verificado

Código `dae4821e` publicado y desplegado en staging: running/healthy,0reinicios, APIlocal/pública200, DBconnected/circuitCLOSED. Cinco controles nuevos compilados, guard central y rutas/modelos aprobados con servicios externos aislados. Env/compose/modelos intactos; imagen/rollback en `whatsapp-batch-256-257-staging-deployment.json`. Producción244 sin cambios. Commit posterior solo documental, sin reconstrucción. La primera comprobación ocurrió durante arranque; la posterior verificación completa pasó. Reiniciar el borrador de prueba antes de reenviar los audios: no se modificaron carritos históricos.
