# Tandas266–267: corrección de preparación y recuperación del pedido

Fuente: fragmento de conversación aportado por el usuario el28/10/2026,16:38–16:44. Se conservan solo frases de pedido, sin teléfono ni identidad.

Carrito observado: dos ejecutivos fritos de una unidad; uno Pierna Pernil, otro Ala, pechuga; ambos Ajiaco, Limonada y nota Limonada bajita de azúcar. El cambio del de pechuga a broaster debe sustituir únicamente su SKU y precio, conservando el resto. «No no quiero Un Pollo quitalo» debe retirar el pollo suelto añadido por error sin tocar ejecutivos. La explicación con «sino» o typo«sink» conserva la familia y utiliza la opción para identificar el dueño.

Se reutiliza el reemplazo atómico existente con una línea concreta y un destino de catálogo. El título del catálogo no se vuelve a interpretar como nota libre: el primer foco detectó una nota espuria en el menú sintético de tofu y se corrigió conservando las expectativas. Las preguntas de cambio tampoco añaden productos; se indica una instrucción explícita para aplicarlo. El rechazo seguido de quítalo reutiliza la retirada por línea, con protecciones de selecciones y pagos. Una petición vaga de cambiar un plato solo aclara.

Baseline válido26/26rojo, foco206/206 con98casos nuevos. Un primer oráculo del saludo completo esperaba inferencia real con un agente simulado vacío: dos fallos excluidos como prueba de defecto en producción y sustituidos por el carrito observado. No se atribuye a Luna el fallo del saludo ni se afirma replay integral del chat. No se ha ejecutado inferencia real ni inspeccionado la traza de aquel mensaje en esta tanda.

Cobertura: PPP y tres menús, agente simulado off/on; preguntas, ambigüedad, dueño desconocido, línea con varias unidades, pago/selección pendientes, estilo agotado, variante duplicada, opciones incompatibles y preparación previa contradictoria. Recuperación tras pollo erróneo, petición vaga, corrección y DTO conservando las notas. Todos los servicios externos simulados. No audio, PDF ni canal real; no cambio de modelos, nueva persistencia ni migración SQL.

Global y despliegue: ver whatsapp-batch-266-267-validation.json; la aprobación global usa inventario exacto y código congelado. El despliegue de esta tanda se limita a staging.

Código `ac8c2cd5` publicado y desplegado solo en staging: healthy,0reinicios, APIlocal/pública200, DBconnected/circuitCLOSED;18controles compilados nuevos/previos y guard central aprobados con servicios externos aislados. Env/compose/modelos intactos; producción265 verificada sin cambios. Evidencia `whatsapp-batch-266-267-staging-deployment.json`; commit posterior documental, sin reconstrucción. Delta266–267 pendiente de portar a Kamppo; no se modificó ese repositorio.
