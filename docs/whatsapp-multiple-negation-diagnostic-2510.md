# Tanda195 — negaciones múltiples en varios menús

Base73f84e26, staging, 25/10. Se amplía el fallo real «no va la gaseosa de400ml ni la porción de arepas». Esta tanda es diagnóstica: no modifica runtime ni acredita corrección.

## Matriz

54 casos en `src/whatsapp/whatsapp-multiple-negation.repro.ts`:

- 48 recorridos:3menús (hamburguesa, bento, pizza) × agente simulado off/on × compra/pago × extras presentes/ausentes × «no va/no quiero A ni B».
- Cada recorrido envía dos veces la frase y captura carrito, respuesta, estado y selección pendiente. Exige conservar el plato principal y su nota, quitar solo los extras, no abrir opciones y explicar lo ocurrido. El cierre hasta DTO solo se ejecuta si pasan esas comprobaciones.
- Seis controles positivos compran los dos extras sin negación; protegen el comportamiento de añadir de verdad.

Resultado: **46 fallidos /8 aprobados**,28,193s (`/tmp/ppp-195-negation.json`). Los ocho verdes son seis controles positivos y dos negaciones con extras ya ausentes (bento en compra, agenteoff/on); solo estos dos últimos llegan a verificar el DTO. No atribuir cobertura de DTO a los46 fallidos.

Los48 snapshots del primer turno muestran29carritos incorrectos y19con el carrito esperado. Entre los29incorrectos:10aumentan unidades,15conservan indebidamente las unidades originales y4solo eliminan parcialmente. Que el carrito esté correcto no basta:17de esos19 casos no cumplen el contrato completo de respuesta/flujo. No afirmar que los46fallos son duplicaciones ni que el agente real fue evaluado.

Evidencia local `/tmp/ppp-195-negation-*.json`. Las respuestas se capturan acumuladas: la repetición inmediata puede reutilizar/suprimir respuesta por deduplicación; estos casos no acreditan una nueva respuesta por cada reenvío ni la repetición tras un intervalo real.

## Hallazgo de código

`parseScopedCartRemoval` documenta y admite una eliminación explícita de un solo producto (`quita/saca/elimina/retira/borra`). No admite el prefijo «no va/no quiero» ni una lista negativa. Es una carencia comprobable, pero no demuestra por sí sola qué ruta alternativa hizo cada mutación: instrumentar antes de atribuir toda la familia a ese único método.

Ejemplo sintético: durante pago, rechazar limonada y papa francesa añade papa si no existe y duplica una línea si ya existe. «No quiero...» puede responder «Conservo ...» o preguntar qué producto cambiar aunque ya se nombraron ambos.

## Siguiente corrección

1. Reconocer una negación múltiple inequívoca antes de compra/edición genérica; distinguir «no quiero que quites» (conservar), sustitución y pregunta.
2. Resolver ambos objetivos contra líneas independientes del carrito. No usar atributos de un combo para eliminar el producto padre por rechazar una bebida aparte.
3. Aplicar una sola actualización de sesión; si hay ambigüedad, preguntar específicamente sin añadir ni borrar la línea equivocada. Producto ya ausente: reconocerlo, sin abrir compra/sabor.
4. Preservar cantidad/notas del plato principal, estado de cierre y datos de contacto. Proteger pagos iniciados y pedidos ya cerrados. Repetición tardía no debe volver a añadir nada.
5. Ampliar controles con nombres que contienen «y», componentes de combos, líneas partidas y negación seguida de compra/consulta. Instrumentar las rutas reales. Promover casos a regresiones verdes tras corregir, manteniendo diagnóstico restante visible.
6. Foco primero; TypeScript/build/Node y global congelada cuando se cambie runtime. No repetir la global por esta tanda exclusivamente diagnóstica: última global19418.569/261 permanece como evidencia del código vigente.

Cero llamadas pagadas, Meta o pedidos externos. Solo staging; sin despliegue ni cambios en Main. Siguen abiertos7up, dirección de cortesía, reparto de sopas y los ocho diagnósticos191/192. No declarar piloto listo.
