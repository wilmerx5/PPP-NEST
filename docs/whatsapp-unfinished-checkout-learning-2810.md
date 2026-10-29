# Pedidos sin cierre: registro de aprendizaje y tanda271

## Método vigente

Fuente: chats que el usuario compartió el28/10 y auditorías de exports ya existentes. No se conectó un feed nuevo de producción. Se convierten frases en regresiones con datos sintéticos, se reproduce el fallo y se modifica el motor por reglas generales. Esto es mejora supervisada del software, no entrenamiento automático del modelo ni memoria de clientes.

Cada caso distingue lo observado, la hipótesis de fricción y el resultado reproducido. Un chat que termina no prueba abandono causado por el bot; una orden cerrada tampoco prueba que todo fuera correcto. No calcular conversión con estas muestras ni guardar teléfonos/direcciones reales en fixtures.

## Caso observado: pregunta de pago ignorada

El cliente dijo «Estefani» y «Me indicas el nequi». El bot pidió la dirección y el borrador expiró. La pregunta no se respondió; eso es un fallo observable. No sabemos si fue la causa del silencio.268 cubrió la frase original;271 amplía el lenguaje coloquial derivado: «Veci me regalas el nequi porfa», «Me pasas tu nequi», «A qué número transfiero», «Me compartes el número para transferir» y «Cuál es tu Nequi».

Antes del cambio:42 fallos/30 aprobadas en72 casos. Después:72/72 nuevas, foco318/4 aprobado. Tres cartas y agente simulado off/on. El recorrido nombre+pregunta en ráfaga llega a DTO con nombre y nota correctos, sin crear la orden antes de confirmar. Consultar la cuenta no elige el método. Una solicitud mixta sigue la ruta normal, y «mi Nequi es…» no pregunta por el comercio. Si faltan datos configurados, no se inventan.

Cambio: reconocimiento acotado de consultas completas sobre cuentas, con cortesía, posesivos y verbo transferir. Sin datos de cuenta, productos o precios fijos en runtime. Sin nueva persistencia, migración SQL ni cambio de modelos. Global aprobada: 21476 pruebas/335 suites; TypeScript general/build y Node aprobados. Código `4f70698b` publicado y desplegado en staging: healthy,0reinicios, APIlocal/pública200, DBconnected/circuitCLOSED. Nueve controles compilados nuevos y31previos aprobados con dependencias aisladas; routing/modelos y guard central aprobados. Env/compose preservados y producción265 verificada sin cambios. Evidencia `whatsapp-batch-271-staging-deployment.json`; cierre documental posterior sin reconstrucción.

## Otras señales y siguientes tandas

- «Dime?» después de anotar salsas: el bot reiteró la nota y preguntó si quería algo más; luego hubo silencio. No consta una instrucción explícita de cerrar ni demuestra por sí solo fallo. Probar recuperación contextual sin inventar que el cliente terminó.
- «Solo eso porfa» seguido de un conjunto: ambigüedad de destinatario/destino.268–270 tienen cobertura; queda reducir repetición cuando envía una ubicación antes de aclarar el conjunto.
- «Natalia» seguido de «Voy»: error observable de nombre compuesto;268–269 cubren nombre y espera, conservando nombres reales de varias palabras.
- Solicitudes de salsas después de confirmar:268–269 distinguen cambio de seguimiento. No se añadió edición automática de la orden.
- Inicio original con dos ejecutivos y opciones distintas: continúa pendiente de validar de principio a fin con el modelo; cambios sobre carrito preparado no certifican esa interpretación inicial.

No mandar recordatorios ni reabrir pedidos expirados automáticamente a partir de este registro. Mantener información personal del export fuera de Git. Próxima evaluación debe medir si el bot responde la pregunta, conserva el pedido y pide un siguiente dato pertinente; el silencio se registra como resultado desconocido.

## Límites

Servicios externos y modelos simulados. Cero inferencia pagada, Meta u órdenes externas. No certifica audio/PDF, comportamiento del modelo real, concurrencia del canal ni mejora de conversión. Producción sigue265; portar delta266–271 a Kamppo sigue pendiente.
