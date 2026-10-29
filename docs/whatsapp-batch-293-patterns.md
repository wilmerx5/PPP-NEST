# Tanda293 — recuperación de edición mixta hasta orden

## VIGENTE — tanda293: recuperación mixta hasta cierre (29/10)

Después de promover283–292 aMain, se añaden36 recorridos sintéticos con tres catálogos, agente simulado off/on y efectivo/transferencia. Una operación mixta inválida (destino inexistente, unidades insuficientes o condición) conserva el carrito; la corrección válida permite seguir por recogida, pago, revisión, confirmación y DTO correcto. Repetir confirmar no duplica la orden. Foco456/2, TypeScript general/build aprobados.

Solo pruebas, sin cambios de runtime ni despliegue nuevo. PPP staging/producción siguen con código292 verificado; Kamppo282. Global final del runtime:26311/359 en292; no atribuir ese global al inventario ampliado293. Cero inferencia/Meta/órdenes externas; presupuesto267/256/11 intacto. Evidencia `whatsapp-batch-293-validation.json`. Siguiente: opciones/aclaración de operaciones mixtas y matriz trazable de fuentes/paridad; medios originales y prueba real del modelo permanecen aparte.


La primera ejecución encontró una omisión del fixture: faltaba simular `reopenForNewOrder` para el mensaje repetido después del cierre. Se completó el mock con el reinicio de sesión existente; no hubo modificación del router. La confirmación repetida comprueba ausencia de duplicado, no continuidad del estado completed.
