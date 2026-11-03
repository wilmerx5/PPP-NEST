# Tanda360 — retomar cotizaciones tras consultas de pago

Casos derivados de los chats previos sobre ofertas aceptadas sin avance y del siguiente paso del plan359; no nuevos chats reales. El bot conservaba pendingAddOffer al consultar datáfono, pero respondía «¿qué te gustaría pedir?» sin recordar qué estaba pendiente. Se añade recordatorio de producto/cantidad y decisión sí/no al recuperar el paso interrumpido. Para cotizaciones múltiples se refiere a todos los productos cotizados, no solo al primero. No añade productos al consultar ni cambia el pago.

Baseline exploratoria48/48 fallida:24 fallos reales de claridad en oferta individual vacía y24 preparaciones inválidas que no generaban oferta al consultar con carrito ya ocupado. Se retiraron esas preparaciones; no se cuentan como errores corregidos.28 regresiones finales:24 individuales en dos catálogos × agente off/mock × tres preguntas × aceptar/rechazar, con12 cierres DTO simulados;4 cotizaciones múltiples y aceptación/rechazo. Foco previo151/3 y final28/1 aprobados. Código1f81890e.

Global34198/428 aprobada;646 fuentes congeladas e inventario exacto. TypeScript general/build y scripts aprobados. Staging360 desplegado/verificado: `d54591ce`, healthy, cero reinicios, API local/pública ok y modelos/configuración preservados. Workflow41558191922; evidencia360-staging-deployment. Controles compilados existentes aprobados; cobertura360 local. Producción349 y Kamppo321 sin cambios. Cero inferencia pagada, Meta y órdenes externas; presupuesto267/256/11 intacto. No acredita modelo/canal real ni todos los tipos de interrupción.

Próximo: consultas informativas con carrito vacío y oferta pendiente (menú, tiempos), y coherencia entre recordatorio y decisión al volver de esas consultas.
