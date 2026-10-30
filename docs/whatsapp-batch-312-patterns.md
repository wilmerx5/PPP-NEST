## VIGENTE — tanda312: retirar una nota conservando las demás (30/10)

Base `3296e63a`.384 recorridos sintéticos:3 catálogos ×agente simulado off/on ×origen único/ambiguo ×atributo previo compartido ×destino nuevo/existente ×4 escenarios (directo, repetición, total, posición inexistente) ×efectivo/transferencia. Tras reparto añade dos notas a cada grupo y retira únicamente sin hielo/sin azúcar, conservando bolsa aparte. Comprueba respuesta, carrito exacto, notas de las líneas de origen, cantidades/opciones, idempotencia de retirada, total, estados de checkout, ausencia de orden anticipada, una creación y DTO/recibo sin las notas retiradas.

384 nuevos +446 relacionados =830 pruebas/3 suites aprobadas; TypeScript general/build aprobados. Sin fallo nuevo del motor en estos escenarios. Solo pruebas; último global del runtime31148/377 en310, no reejecutado ni atribuido al inventario ampliado312. Evidencia `whatsapp-batch-312-validation.json`.

Sin despliegue nuevo: última verificación PPP staging310 (`1470d8e8`), producción292 y Kamppo282. Cero inferencia/Meta/órdenes externas; ledger267/256/11 intacto. No revisión nueva de chats/PDF/audio. Pendientes: notas diferentes dentro de la misma frase del reparto, opciones implícitas y planificación general de varias operaciones. Idiomas aplazados.

