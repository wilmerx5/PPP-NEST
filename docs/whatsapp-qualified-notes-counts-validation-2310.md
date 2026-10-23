# Tanda 125 — notas de preparación, reparto de unidades y consultas de apertura

Base 1e6a2961, rama staging. Dos chats del usuario: pedido de milanesa con harta ensalada + pollo + ajiaco a cambio del arroz yuca; y dos sopas, una con harto arroz y otra con harta ensalada. Se añade consulta sobre rechazo y consultas de apertura.

## Reproducción y causa

El validador real de add_item rechazaba `arta` y `cambio/yuca` como composición no disponible. El parser alternativo también perdía la milanesa. `interpretProductNote` aceptaba harto/arto pero no harta/arta, y no la sustitución compacta anclada en un plato exacto. El primer baseline tuvo cuatro fallos y un aprobado. El test directo del agente ahora pasa por alignMenuSpelling igual que el router: la carta de fixture escribe Milensa, el cliente milanesa. No se introdujo una excepción por nombre.

El follow-up «por qué no puedes añadir…» podía convertirse en compra sin las notas originales. Se protege en router y herramienta como consulta, conservando carrito y pidiendo una nueva solicitud explícita para reintentar. No se afirma que el restaurante esté agotado si el catálogo sí muestra el plato. No hay reintento automático mediante «sí» pendiente; el texto lo explica.

El reparto `dos … una … y la otra …` tenía expansión para opciones y notas `sin`, pero no `con harto/harta…`. Se amplía esa forma acotada. El validador de herramientas usa una nota literal única para ubicar el segmento y validar su cantidad: una llamada que proponga dos para el grupo de una se corrige a una, sin reutilizar el total en cada grupo. No se cambia el carrito previo ni se mezclan notas.

`ya abriste?` y `puedo hacer un pedido?` no entraban siempre a la consulta de horario. Se reconocen esas formas y se consulta BusinessService; el mensaje de cerrado agradece, muestra horario y ofrece atender en horario. GET público de staging durante la tanda devolvió fecha 2026-10-23, America/Bogota, isOpen=true, 00:00–23:59. Esto acredita configuración actual, no la de las 23:59 del día anterior. No se cambió horario ni ignoreBusinessHours.

## Cobertura y límites

40 pruebas nuevas: 32 en whatsapp-qualified-purchase-recovery y ocho en closed-service-brief. Router con agente simulado on/off, validadores reales de herramientas con proveedor simulado, PPP y tres menús sintéticos; carrito, notas separadas, respuesta y DTO simulado. Controles conservan rechazo de composición desconocida y diferencian una compra explícita de pregunta. Foco final 71/71 en cuatro suites. TypeScript general/build aprobado; Node 92/92. Cero API pagada, WhatsApp u órdenes externas.

Primer intento global se detuvo expresamente al recibir el segundo chat del usuario para incorporar cantidades/horario; no cuenta como aprobación. Segundo run aprobado: 16.584/16.584, 194 suites, 492 hashes intactos, inventario exacto; 762,95 segundos. Evidencia /tmp/ppp-125-global-summary.json y logs burst/rest. La advertencia de classifyMessage ausente en un mock pertenece al fixture; no se usa como evidencia del modelo real. No acredita reconocimiento acústico ni interpreta todas las variantes de reparto libre. Sustituciones quedan como petición de cocina, no garantía de disponibilidad de acompañamientos.

Siguiente: repartos con tres grupos, corrección de un grupo ya pendiente y paráfrasis de notas en llamadas de herramienta, conservando siempre total y DTO. Añadir conversación completa que combine esas correcciones con consultas y cierre. No declarar listo para venta por número de tests. Main y producción se preservan; no modificar el acceso público ni habilitar eventos externos de staging.

Publicado y desplegado exclusivamente en staging: 52fa1e95, imagen d0671e0c…, verificado 23/10 00:26:40 Bogotá (05:26:40Z): running/healthy, cero reinicios, health OK, DB connected, circuit CLOSED. publicChat=true y orderEvents=false conservados. Producción mantiene ef426c93… y Main intacta. Rollback ppp-nest-staging:rollback-before-52fa1e95. Evidencia /tmp/ppp-125-deploy.log y /tmp/ppp-125-deploy-verified.log; bin/ privado, bases y volúmenes preservados. Evidencia focal: /tmp/ppp-125-final-focus.log; TypeScript /tmp/ppp-125-final-tsc.log; Node /tmp/ppp-125-node.log.
