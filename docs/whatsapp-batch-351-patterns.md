# Tanda351 — tiempo de entrega durante aclaración de nota

## Origen

Siguiente paso acordado tras350. Escenarios sintéticos derivados de preguntas reales de demora y de la aclaración348: dos líneas con igual preparación, cantidades2 y1, opciones/notas distintas; se pregunta el tiempo antes de seleccionar dónde aplicar «sin arroz». No es una transcripción literal de un cliente.

Baseline66 fallos/80:64 recorridos y2 controles de repetición no recibían tiempo;14 guardas ya pasaban. La respuesta repetía candidatos sin resolver la consulta.

## Corrección

Un detector acotado de consulta independiente de demora permite responder dentro del resolvedor de la nota, después de validar firma/caducidad y bloqueos de pago/otras selecciones. Usa el tiempo configurado, añadiendo minutos a un rango numérico; sin configuración pide que el equipo confirme el tiempo y no usa el valor genérico35–45. Conserva carrito, estado, candidatos y fecha de la aclaración. No procesa acciones mezcladas, condiciones ni seguimiento de una orden específica como ETA genérica.

88 regresiones:64 recorridos en dos catálogos × agente off/mock × carrito/confirmación × ETA configurada/ausente ×4 preguntas;16 guardas;8 cortesías/variantes con cancelación posterior.64 recorridos cierran con DTO/recibo simulado,3 unidades y solo una con nota nueva. Foco inicial246/4 y final88/1 aprobados. Global33721/419 aprobada,637 fuentes congeladas e inventario exacto; TypeScript general/build y scripts aprobados. Staging351 desplegado/verificado: `56846fb8`, healthy, cero reinicios, API local/pública ok y modelos/configuración preservados. Workflow41498203435; evidencia351-staging-deployment. Controles compilados existentes aprobados; cobertura351 local.

## Límites

Cero inferencia pagada, Meta y órdenes externas. No acredita modelo/canal real. Cambio acotado a la aclaración por preparación348, sin cambiar el ETA genérico de otros flujos. Producción349 y Kamppo321 fuera del alcance. Próximo: pregunta combinada de total y demora dentro de esta aclaración, con selección/corrección posterior; U3/U4 siguen abiertos.
