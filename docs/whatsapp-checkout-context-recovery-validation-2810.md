# Tanda269 — espera, aclaración de lugar y seguimiento de suministros (28/10/2026)

Base `61977986a828977a933d5f35719aa90e57d4116c`, rama staging. Continúa los chats reales de tanda268 con variantes derivadas, usando datos sintéticos.

## Comportamiento

- «Voy», «ya voy», «un momento» y «ya te digo», enviados en otro turno durante checkout, reciben una aceptación breve sin cambiar nombre, destino, pago, notas ni carrito. Una petición explícita de recogida continúa por su flujo normal.
- El rótulo ambiguo de «solo eso» + nombre/lugar se recuerda hasta que el cliente aclare su función. «Es el barrio/conjunto» conserva el lugar para adjuntarlo a la dirección completa posterior; «es mi nombre» resuelve el destinatario.
- Un nombre nuevo explícito reemplaza la duda sin adjudicar el rótulo anterior a un lugar. Una consulta de pago no consume la duda. «Sí», «confirmar» y una pregunta sobre la función del rótulo no eligen una interpretación.
- La confirmación central bloquea el pedido si falta resolver esa función, incluso con skipFinalConfirm y aunque otro flujo haya suministrado nombre/dirección. Es posible resolverla desde los estados de checkout posteriores.
- «Con salsas porfa», «me regalas unas servilletas» y «me puedes enviar sobres de salsa» después de confirmar no abren un carrito nuevo ni declaran aplicado el cambio: explican que falta confirmarlo con el comercio.
- El aviso sobre cambios no afirma que existe una orden solo porque el chat esté cerrado. Un pedido nuevo explícito conserva su flujo normal.

Campo JSON opcional nuevo: `pendingRecipientOrPlace`. Sin migración SQL. Se elimina al resolver, reemplazar explícitamente el nombre o reiniciar. Si hay que volver a una imagen anterior, resolver o cancelar normalmente los borradores que tengan esa duda antes del rollback; no borrar datos de clientes.

## Evidencia y límites

Baseline: 66/66 casos fallaban. Veinticuatro eran calidad de respuesta a espera (el carrito ya se conservaba); no se presentan como corrupción de datos. Los demás cubrían función del rótulo, suministro posterior y afirmación incorrecta sobre un chat cerrado. Al añadir guardas surgieron seis fallos de pregunta frente a afirmación («¿es el barrio?»); se corrigieron manteniendo la duda sin modificar datos.

114 regresiones nuevas en tres cartas/platos × agente simulado apagado/encendido. Los flujos de espera y lugar llegan hasta DTO, conservando nombre, producto y nota «Sin cebolla». Incluye confirmación central, consulta de pago intercalada, reinicio, nuevo pedido y recogida. Foco final: 372 pruebas / 5 suites.

Global aprobada: 21350 pruebas / 333 suites, inventario exacto, TypeScript general/build y Node aprobados. Despliegue staging pendiente de verificación. No se cambia código fuente mientras corre la global. No hay llamadas pagadas, Meta ni órdenes externas; modelos y ledger267/256/11 preservados.

No es evaluación real de inferencia, canal, audio o PDF. No añade edición automática de pedidos confirmados ni notificaciones. Los pedidos del chat se simulan; no se modifica la orden de ningún cliente. Producción continúa265; el delta269 se suma al traslado pendiente266–268 a Kamppo. El arranque original de dos ejecutivos y la muestra reservada siguen pendientes.
