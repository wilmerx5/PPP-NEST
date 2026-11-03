# Tanda363 — cotizaciones múltiples ante cambios de catálogo

Continuidad de362 y patrones previos de aceptación de ofertas. Casos derivados, no nuevos chats reales. La oferta múltiple almacenaba IDs pero no todos los precios; al aceptar filtraba los agotados y podía agregar el resto sin aclaración.

Baseline52/56 fallan:32 precio cambiado,16 disponibilidad parcial y4 oferta sin snapshot.4 controles sin cambios ya pasaban. Ahora la cotización conserva ID/nombre/precio por producto desde el mismo catálogo usado para responder. Al aceptar valida disponibilidad de todos; si alguno falta, no agrega ninguno, identifica faltantes y retira la oferta para pedir una nueva selección. Cambio de precio muestra nuevos importes y pide otra aceptación. Ofertas antiguas sin snapshot completo se recotizan antes de agregar. Revalida en cada aceptación.

68 regresiones:32 subida/bajada en ambos productos y aceptar/rechazar;16 retiro/agotamiento parcial y recuperación explícita;4 sin cambios;4 legacy;8 cambio/agotamiento posterior;4 retiro total. Dos catálogos × agente off/mock;16 cierres DTO simulados. Foco228/4 y final68/1 aprobados. Código9508da43.

Global34410/431 aprobada;649 fuentes congeladas e inventario exacto. TypeScript general/build y scripts aprobados. Staging363 desplegado/verificado: `6322b444`, healthy, cero reinicios, API local/pública ok y modelos/configuración preservados. Workflow41567153690; evidencia363-staging-deployment. Controles compilados existentes aprobados; cobertura363 local. Producción349 y Kamppo321 sin cambios. Cero inferencia pagada, Meta y órdenes externas; presupuesto267/256/11 intacto. No acredita modelo/canal real.

Límites: snapshot de precios base por producto; no amplía cantidades distintas por línea ni elección de otro tamaño. Disponibilidad parcial requiere volver a indicar lo deseado; no ofrece aceptación implícita de los restantes. Próximo: repetición/reformulación y cantidades distintas dentro de una cotización múltiple; revisar primero cobertura previa antes de ampliar.
