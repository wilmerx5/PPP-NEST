# Tanda362 — precio actualizado al aceptar cotización individual

Casos derivados de los chats previos y plan361; no nuevos chats reales. La revisión mostró guardas de recotización para combos y selecciones, pero aceptación simple de pendingAddOffer usaba el precio actual sin advertir que difería del cotizado. Se priorizó este riesgo antes de ampliar repetición/reformulación.

Baseline32/56 fallan: cambios de precio al aceptar.24 controles de precio idéntico o producto agotado/retirado ya pasaban. Ahora un producto individual del mismo ID con precio distinto conserva carrito y cantidad, actualiza la oferta, explica precio anterior/nuevo por unidad y requiere otra aceptación. Si cambia nuevamente vuelve a pedir aceptación; si desaparece o se agota, no lo agrega. Mantiene la ruta existente de tamaños distintos; no compara precios de IDs diferentes.

72 regresiones:32 recorridos de subida/bajada y aceptar/rechazar con1/2 unidades;16 agotado/retirado;8 precio idéntico;8 segundo cambio/agotamiento tras recotizar;8 aceptación por número o «agrega los dos». Dos catálogos × agente off/mock;16 cierres DTO simulados. Foco224/4 y final72/1 aprobados. Código53b782dc.

Global34342/430 aprobada;648 fuentes congeladas e inventario exacto. TypeScript general/build y scripts aprobados. Staging362 desplegado/verificado: `73619687`, healthy, cero reinicios, API local/pública ok y modelos/configuración preservados. Workflow41563702440; evidencia362-staging-deployment. Controles compilados existentes aprobados; cobertura362 local. Producción349 y Kamppo321 sin cambios. Cero inferencia pagada, Meta y órdenes externas; presupuesto267/256/11 intacto. No acredita modelo/canal real.

Pendiente prioritario: cotizaciones de varios productos ante cambio de precio o agotamiento parcial (snapshot y aceptación coherentes); luego repetir/reformular preguntas con oferta pendiente. Esta tanda no corrige la aceptación múltiple ni amplía cambios de tamaño.
