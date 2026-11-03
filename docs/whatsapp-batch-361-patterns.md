# Tanda361 — menú y tiempo durante cotización pendiente

Continuidad de360 y patrones de chats aportados previamente: consultas antes de aceptar la compra. Casos derivados, no nuevos chats reales. Una cotización sin aceptar puede dejar carrito vacío; pedir el menú omitía el recordatorio por comprobar solo carrito. Las preguntas generales de tiempo tampoco retomaban correctamente la decisión.

Baseline64/64 fallan en continuidad. Se conserva la oferta y se retoma la pregunta sí/no tras menú, y se responde ETA general con el recordatorio cuando hay oferta y carrito vacío. Se amplía el reconocimiento de «cuánto tarda la entrega»; las consultas mixtas, condicionales, con datos y sobre orden concreta no son consultas aisladas.

72 controles nuevos:64 recorridos en dos catálogos × agente off/mock × oferta individual/múltiple × cuatro consultas × aceptar/rechazar, incluidos32 cierres DTO simulados;8 guardas de consultas no aisladas. Foco92/2 y final72/1 aprobados. Códigof3972949. Una primera ejecución no llegó a probar casos por propiedad de configuración incorrecta en el fixture; se corrigió antes de medir baseline.

Global34270/429 aprobada;647 fuentes congeladas e inventario exacto. TypeScript general/build y scripts aprobados. Staging361 desplegado/verificado: `bb0b9cc4`, healthy, cero reinicios, API local/pública ok y modelos/configuración preservados. Workflow41560854089; evidencia361-staging-deployment. Controles compilados existentes aprobados; cobertura361 local. Producción349 y Kamppo321 sin cambios. Sin inferencia pagada, Meta ni órdenes externas; presupuesto267/256/11 intacto. No acredita modelo/canal real. No confirma disponibilidad física ni tiempo real de llegada.

Próximo: repetición o reformulación de preguntas con oferta pendiente, cantidades cotizadas y cambios de disponibilidad/precio entre consulta y aceptación.
