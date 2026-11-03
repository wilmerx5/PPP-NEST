# Tanda352 — total y demora durante aclaración de nota

## Evidencia y reproducción

Siguiente paso acordado tras350/351. Escenario sintético derivado de preguntas de precio/demora y correcciones conversacionales de los chats compartidos. No se presenta como transcripción literal. Dos líneas con la misma preparación y cantidades2/1; un agua ajena precede los candidatos. Consultar total+ETA antes de elegir repetía opciones o respondía solo el total.

Baseline66 fallos/80:64 recorridos y2 repeticiones fallaban;14 guardas ya aprobaban. Se reutiliza el detector combinado336 dentro del resolvedor348, conservando sus validaciones previas de firma/caducidad/otras selecciones/pago. Responde resumen, ETA configurada o necesidad de confirmarla y candidatos originales. No cambia carrito, estado ni fecha de la aclaración.

84 controles nuevos:64 recorridos en dos catálogos × agente off/mock × carrito/confirmación × ETA configurada/ausente ×4 preguntas;16 guardas;4 tarifas de domicilio conocidas/pendientes.64 recorridos consultan, eligen1, corrigen «no, el otro» y cierran con DTO/recibo simulado:4 unidades totales, agua intacta, notas anteriores restauradas y nueva nota solo en la unidad de destino. Números corresponden a candidatos, no al carrito completo.

Foco inicial334/5 y final84/1 aprobados. Global33805/420 aprobada,638 fuentes congeladas; TypeScript general/build y scripts aprobados. Despliegue agrupado con353 por nuevo chat prioritario del02/11.

## Límites y siguiente prioridad

Cero inferencia pagada, Meta u órdenes externas. No acredita canal/modelo real. No amplía el detector336 a nuevas intenciones. Producción349 y Kamppo321 fuera del alcance. Próximo: cambio o retirada explícita de producto durante una aclaración pendiente; verificar que no se aplique luego una nota sobre un carrito desactualizado. U3/U4 siguen abiertos.

Staging352–353 desplegado/verificado: `5850d12f`, healthy, cero reinicios, API local/pública ok y modelos/configuración preservados. Workflow41504255082; evidencia353-staging-deployment. Controles compilados existentes aprobados; cobertura352–353 local.
