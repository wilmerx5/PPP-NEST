# Tanda355 — retirada/cantidad durante aclaración de nota

## Evidencia

Siguiente paso del plan tras354. Escenarios sintéticos derivados de correcciones conversacionales observadas, no transcripciones literales: el bot aclara qué línea broaster lleva «sin arroz» y el cliente pide retirar la de una opción concreta o corregir su cantidad. Baseline16 fallos/36;20 guardas ya aprobaban.

## Cambio

Dentro del resolvedor348, tras validar firma/caducidad/pago/otras selecciones, una retirada o corrección absoluta de cantidad con referencia nominal única usa los manejadores existentes. No interpreta ordinales de candidatos como filas del carrito. Condiciones y referencias ambiguas/desconocidas conservan la aclaración. Cantidad ya coincidente conserva pendiente. Validaciones existentes de límites/conflictos permanecen.

Solo un cambio real del carrito descarta la nota pendiente; se avisa explícitamente que no se aplicó y que debe indicarse de nuevo si se necesita. Respuestas numéricas posteriores no aplican la nota antigua. No se reemplazan productos/preparaciones en esta tanda.

44 controles nuevos:24 recorridos de dos catálogos × agente off/mock × carrito/confirmación × retirada completa/parcial/cantidad;20 guardas.24 cierres DTO/recibo simulado verifican cantidades finales1/2/4, notas/opciones previas y ausencia de «sin arroz». Foco232/4 antes de ampliar retirada parcial; final44/1 aprobado. Global33963/423 aprobada,641 fuentes congeladas e inventario exacto; TypeScript general/build y scripts aprobados. Staging355 desplegado/verificado: `f6f5159e`, healthy, cero reinicios, API local/pública ok y modelos/configuración preservados. Workflow41515895462; evidencia355-staging-deployment. Controles compilados existentes aprobados; cobertura355 local.

## Límites y próximo paso

Cero inferencia pagada, Meta u órdenes externas; no acredita modelo/canal real. Preparación/nota ambigua no resuelta se descarta explícitamente al cambiar carrito, no se transfiere por inferencia. Próximo: sustitución de producto/preparación mientras hay aclaración de nota; mismos controles de identidad, conservación e invalidación. Producción349 y Kamppo321 sin cambios; U3/U4 siguen abiertos.
