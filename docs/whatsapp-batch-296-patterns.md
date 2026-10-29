# Tanda296 — redirección de notas hasta checkout

## VIGENTE — tanda296: «el otro» hasta orden y recibo (29/10)

Base `9099e57a`.48 recorridos nuevos sobre tres catálogos sintéticos, agente simulado off/on y efectivo/transferencia. Nota «sin cebolla» aplicada a una línea; «no, el otro» con destino único, aclaración entre varias líneas, destino con nota incompatible y cancelación de la redirección. Conserva el carrito mientras aclara; la resolución mueve solo la nota reciente y mantiene las notas anteriores, bebidas, presentaciones, cantidades y precios. Continúa por recogida, pago, revisión y confirmación; DTO y recibo contienen la nota en el plato correcto. No crea orden antes de confirmar.

Baseline48/48; foco480/3; TypeScript general/build aprobados. Solo pruebas, sin cambios del motor ni despliegue nuevo. Último global de runtime:26514/362 en295; no atribuirlo al inventario ampliado296. Evidencia `whatsapp-batch-296-validation.json` y `whatsapp-batch-296-patterns.md`.

PPP staging295, producción292, Kamppo282. Cero inferencia/Meta/órdenes externas; ledger267/256/11 intacto. Carritos preparados de una unidad por línea, no reproducción íntegra de chats nuevos ni prueba de audio. Esta tanda acredita notas; no generaliza «el otro» a cambios de SKU/preparación. Idiomas siguen aplazados. Próximo: referencias de preparación/variante hasta checkout y aclaración persistente de operaciones mixtas.


Fuentes conceptuales: patrones seleccionados `salsas-compuestas` y `pregunta-durante-variante` del corpus local, y ejemplos de corrección por referencia del hilo. Los nuevos recorridos son sintéticos; no se revisaron chats/PDF/audio adicionales. Las suites anteriores comprobaban la redirección; esta añade el recorrido posterior completo, atributos y recibo.
