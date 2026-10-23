# Tanda 132 — ciclo de vida de deshacer opciones

## Objetivo y evidencia

Base e414e883. Cambios sucesivos en tres menús ficticios, sin nombres/IDs de PPP en reglas de producción. 36 casos nuevos: seis combinaciones menú/agente × cinco escenarios de ciclo de vida, más seis de selección de línea ambigua. El DTO conserva tres unidades al deshacer el segundo cambio y cuatro al restaurar la edición seleccionada. Notas y opciones se comprueban por unidad; no basta la respuesta del bot.

Baseline inicial: seis fallos de fixture por mock ausente de reopenForNewOrder; al modelar el reset real, seis fallos funcionales porque deshacer tras confirmar reabría la conversación. Se intercepta antes de reabrir. En revisión se añade el estado closed, que puede significar cierre manual sin orden: su respuesta no afirma que haya pedido registrado. El primer control de closed falló por un oráculo que confundía «no he deshecho» con éxito; se corrigió el oráculo, conservando comprobaciones de estado, carrito, ausencia de reapertura y ausencia de orden.

## Validación

- Foco previo: 210/210, tres suites; aún no incluía seis controles de closed.
- Suite final ampliada: 90/90, 14,882 s, /tmp/ppp-132-lifecycle-final.log.
- TypeScript general/build: aprobados tras la última revisión, /tmp/ppp-132-tsc-final.log.
- Node: 92/92 antes de la última revisión; scripts no cambiaron.
- Global final aprobada: 16.812/16.812, 197 suites, 495 hashes intactos, inventario exacto, 1.592,57 s. /tmp/ppp-132-global-summary.json. Timeout de pruebas 15 s; no cambia tiempos del bot. Historial: Dos intentos de ráfagas fallaron por timeout de 5 s (79/80 y 78/80). Tercer intento pasó 80 ráfagas con presupuesto 15 s, pero se interrumpió tras timeouts de 5 s en part-06 y part-08. No es evidencia de aprobación global. Host con carga CPU elevada y swap ocupado; no atribuir estos tiempos al servicio desplegado ni ocultar los fallos.
- Fuente congelada durante cada ejecución; no hay tests simultáneos ni inferencia de pago.

## Publicación y límites

Global cerrada; pendiente publicación y despliegue agrupado 131+132 exclusivamente en staging. Main/producción preservadas. Sin WhatsApp, OpenAI ni órdenes externas. No se evalúa precisión del modelo real. Solo un deshacer con firma y caducidad, no un historial arbitrario. Próxima tanda: conversaciones completas con compra desde cero, variantes, notas, interrupción de checkout y DTO, para equilibrar la cobertura de ediciones sobre carrito preparado.

## Cierre de ejecución

Cuarto intento sobre fuente final terminado: ambas fases exit0, inventario completo sin duplicaciones y hashes sin cambios. Ráfagas 80/80; bloque restante 16.732/16.732. El margen15s es del runner; los intentos fallidos se preservan. No medir latencia de producción con estos tiempos. Siguiente: publicar/desplegar agrupadas131+132 solo staging y verificar salud/flags/prod. Plan posterior: [conversaciones completas](whatsapp-complete-conversations-next-2310.md).
