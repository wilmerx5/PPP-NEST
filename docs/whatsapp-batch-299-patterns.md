# Tanda299 — aclaración de origen en operaciones mixtas

## VIGENTE — tanda299: aclaración corta de retirada y adición (29/10)

Base `bd836a14`. Si «quita dos de los de pechuga y agrega tres Agua Mineral» tiene varias líneas de origen pero un destino exacto disponible sin opciones requeridas, conserva ambas acciones pendientes. Resuelve con número, «el segundo» o nota distintiva; aplica retirada y adición juntas después de volver a validar catálogo, cantidad y límites. Preguntar total conserva la elección. Precio/nombre/disponibilidad/opciones cambiados, carrito modificado o elección vencida no aplican media operación. Caducidad30min. Cancelar el cambio conserva el carrito; reiniciar sigue vaciándolo por el flujo existente. Confirmar/no más/pregunta no resuelven la elección por accidente.

202 pruebas nuevas:144 recorridos (3 catálogos ×2 agentes simulados ×2 cantidades ×destino nuevo/existente ×6 formas de resolver/interrumpir);16 controles de cambio de catálogo/carrito, pago, límites, cantidad insuficiente y caducidad;42 controles en construcción/pago/confirmación. Baseline160 fallidos; corrección160 aprobados; ampliación detectó6 bloqueos de reinicio, corregidos. Foco1042/4; global27220/366, inventario exacto y579 fuentes congeladas. TypeScript general/build y Node aprobados. Evidencia `whatsapp-batch-299-validation.json`.

Staging299 desplegado y verificado: código `6046e45b`; evidencia `whatsapp-batch-299-staging-deployment.json`. Producción292 y Kamppo282 sin promoción. Cero inferencia/Meta/órdenes externas; ledger267/256/11 intacto. Idiomas aplazados. El destino ambiguo o con atributos sigue solicitando petición completa/elección; esta mejora no acredita un planificador general de operaciones combinadas.

Fuente conceptual: correcciones ambiguas de pedidos aportadas en el hilo y límite documentado en291/293/298. Los recorridos son sintéticos, con carritos preparados; no se leyeron nuevos chats, PDF ni audio. Una prueba verde no acredita extracción inicial por modelo real. Próximo: destino ambiguo o con opciones, con resolución persistente y sin ejecutar una retirada aislada.
