# Texto más económico — comparación preparada el 28/10/2026

Objetivo autorizado por el usuario: comprobar si GPT-6 Luna puede sustituir a GPT-6.1 Sol para texto manteniendo exactitud del pedido y reduciendo el costo por conversación completada. No hay un ganador nuevo ni un cambio de producción.

## Estrategia recomendada

1. Mantener el router y las reglas existentes para resolver los turnos que ya pueden manejar sin inferencia.
2. Evaluar Luna como modelo principal para los demás turnos de texto. Sol es la referencia de calidad actual, no una segunda llamada obligatoria en cada turno.
3. Mantener clasificación/apoyo fijo en Luna durante la comparación y contabilizar esas solicitudes por separado. Fotos y transcripción no cambian en esta evaluación.
4. Si Luna pasa la comparación inicial, ampliar a conversaciones reservadas y después a staging controlado. Un respaldo a Sol solo se implementa si hace falta y se prueba antes de aplicar acciones; no se debe repetir una compra ya aceptada al fallar la respuesta del proveedor.

Las tarifas Standard publicadas por millón de tokens son: Luna entrada $0,10, entrada cacheada $0,01 y salida $0,50; Sol entrada $2, entrada cacheada $0,10 y salida $10. A igual número de tokens, entrada sin caché y salida de Luna cuestan 1/20. Eso no prueba un ahorro de 95 % por pedido: cambian rondas, longitud, caché, posibles reintentos y errores. Fuentes consultadas el 28/10: [Luna](https://developers.openai.com/api/docs/models/gpt-6-luna), [Sol](https://developers.openai.com/api/docs/models/gpt-6.1-sol).

## Comparación concreta

Manifiesto: `scripts/fixtures/whatsapp-text-economy-comparison-2810.json`. Dos conversaciones, con dos menús y los mismos mensajes/código para ambos candidatos:

- PPP: compra mixta con ausencia de producto, consulta de precio, cambio de bebida sin duplicar, captura de contacto/dirección y cierre. Ocho turnos.
- Falafel: combo con nota dirigida, consulta durante el pago, cambio de bebida, reducción absoluta de cantidad, dirección corregida, contacto y cierre. Trece turnos.

Son extensiones de casos de desarrollo ya conocidos; no son una evaluación independiente ni una muestra representativa de clientes. Se preservan cart/response expectations; las expectativas intermedias de estado se adaptan a la captura explícita de contactos del nuevo flujo, y antes de confirmar se exige awaiting_final_confirm. Las referencias de catálogo y los hashes de entradas se verificaron sin red. No se acredita por ello que las conversaciones hayan pasado con ningún modelo.

Propuesta de tope operativo: 40 solicitudes totales, 20 por candidato y 10 por conversación/modelo, una repetición, detenerse al primer fallo. No es una cifra dictada por el usuario ni un límite monetario estricto. Si el tope corta una conversación, no cuenta como aprobada. El ledger actual sigue en 188 acumuladas / 187 usadas / 1 restante; no se modificó. Antes de la ejecución real, ampliar el tope operativo en 39 conservando el historial y sincronizar el espejo privado.

El runner existente es `scripts/whatsapp-live-router-rehearsal.ts`. El override WHATSAPP_AGENT_MODEL debe estar ausente para no imponer el modelo de producción al candidato; WHATSAPP_ASSIST_MODEL queda fijo en gpt-6-luna. No cargar ni imprimir credenciales en el comando o en informes versionados.

## Cómo decidir

Comprobar carrito y respuesta en cada turno; producto, cantidad, opciones y notas en el DTO final; una sola orden simulada después de confirmar; continuidad, latencia y solicitudes. Los turnos con cero solicitudes son evidencia del router, no del modelo. Una sola compra omitida/duplicada o nota aplicada al plato equivocado impide recomendar el candidato a partir de esta muestra.

Medir costo total y costo por conversación correctamente completada, separando entrada sin caché/cache, salida y modelos auxiliares. Contar intentos fallidos y respuestas sin usage como gasto incierto; no como costo cero. Comparar también un escenario sin caché con los mismos tokens, sin presentarlo como consumo observado.

Dos límites del runner requieren atención antes de decidir el ganador: su resumen agregado actual valora todos los tokens al precio del candidato, lo que puede mezclar llamadas al agente Sol con apoyo Luna; atribuir cada solicitud a su modelo real antes de ordenar por costo. Además, orderCount=1 no valida el contenido de la orden: revisar el DTO capturado contra reviewFinalOrder del manifiesto. No publicar un resultado de precisión solo por el contador de órdenes.

## Estado de ejecución

Preparado, no ejecutado con inferencia. La clave OPENAI_API_KEY no está cargada en este entorno y una consulta de conectividad sin autenticación a OpenAI falló con EAI_AGAIN antes de cualquier inferencia. Cero solicitudes pagadas; contadores intactos. No buscar ni copiar claves al repositorio, ni gastar el único intento restante en un reintento ciego de conectividad.

Producción, modelos de fotos/audio y configuración de servidores sin cambios. El ahorro por pedido y la capacidad de Luna siguen por medir. No activar ni afirmar implementado un respaldo Luna→Sol hasta contar con validación específica.
