# Tanda349 — corregir una nota aplicada a la línea equivocada

## Evidencia

Derivado de chats28/10 y30/10 y de la aclaración348. Dos líneas de la misma preparación con cantidades2 y1, distintas opciones y notas; un producto ajeno precede ambas. Aplicar «sin arroz» a la primera y responder «no, el otro», «perdón, el segundo» o «mejor el segundo» no restauraba el origen ni trasladaba la nota. Baseline24/24 fallan.

## Cambio

La selección348 conserva carrito anterior, firma del resultado, fecha y candidatos originales, solo si hubo modificación. La redirección existente admite líneas con varias unidades únicamente en este contexto. Números/ordinales se refieren a la lista de candidatos, no a productos ajenos del carrito. Restaura las notas previas y aplica la nueva a la línea de destino conservando atributos, cantidades y checkout.

Más de dos candidatos provoca nueva aclaración; acepta número, opción o nota previa inequívoca. Repetición, firma/fecha inválida, interrupción, pago o selección pendiente no producen una nueva modificación. No elimina notas que ya existían antes de la solicitud. Conflictos mantienen la nota donde estaba y piden aclaración.

## Validación

56 controles nuevos:24 cierres con DTO/recibo en dos catálogos × agente off/mock × carrito/confirmación ×3 reparaciones;26 guardas;6 aclaraciones entre tres candidatos. Foco56/1 y relacionadas536/4 aprobados. La primera invocación conjunta tuvo error TypeScript en la prueba nueva, corregido antes del foco final; las cuatro suites relacionadas aprobaron sobre el mismo motor. Global aislada33565/417 aprobada,635 fuentes congeladas e inventario exacto; TypeScript general/build y scripts aprobados. No mezcla Bold/autenticación. Staging349 publicado y desplegado:c0e8bc47, workflow41460228361. Contenedor healthy, cero reinicios, API local/pública ok y modelos/configuración preservados. Controles compilados previos aprobados; cobertura349 local.

Sin llamadas pagadas, Meta u órdenes externas. No acredita canal/modelo real ni cierra U3/U4. Límite: redirección inmediata, líneas completas, firma intacta y diez minutos. Próximo: consultar total durante una aclaración y retomarla sin perder la solicitud. Producción333 y Kamppo321 fuera de esta tanda.
