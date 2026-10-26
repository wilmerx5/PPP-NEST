# Tanda 208 — aceptación verbal y precio de combos

Base `358e8c46`, staging, 26/10/2026. Sin llamadas pagadas, Meta ni órdenes externas. No se cambian modelos, Main ni despliegues.

## Hallazgo y alcance

Se repitió el diagnóstico de oferta implícita 205: **18 correctos / 12 fallidos**, sin mejora atribuida a esta tanda (`/tmp/ppp-208-baseline.json`). Los doce fallos ocurren antes de aceptar una propuesta; por eso ese diagnóstico no acreditaba la continuación.

Se creó una matriz independiente que compra realmente el plato base mediante el router y después pregunta «eso lleva bebida?». No se fabrica `replacement.originalLine`. Tres catálogos sintéticos (arroz con pollo, bowl con tofu y pasta con champiñones), agente simulado activo/inactivo, dos unidades con preparación y nota sin cebolla.

Primer diagnóstico: **18 correctos / 6 fallidos** en 24 conversaciones (`/tmp/ppp-208-continuation.json`). El fallo era la aceptación verbal «sí, el combo» tras cambiar el precio de 25.000 a 28.000: el carrito aún conservaba el plato base, pero el bot avanzaba a elegir bebida al precio nuevo sin advertir ni pedir aceptar el cambio. Las pruebas históricas con elección numérica sí cubrían ese control; no cubrían esta vía verbal.

## Corrección

`tryAnswerComboSwapOffer` compara el precio ofrecido con el catálogo actualizado después de reconocer una aceptación válida y antes de recoger atributos o reemplazar el plato. Reutiliza la ruta existente de nueva cotización. Las negativas siguen conservando el plato base y las preguntas no se convierten en aceptación.

Regla general por identidad y precio del catálogo, sin nombres, IDs o precios de restaurantes en runtime. No soluciona todavía la oferta implícita al primer pedido ni promete una bebida que el catálogo no confirme.

## Pruebas

`whatsapp-combo-offer-continuation.spec.ts`: **36 casos** tras promover y ampliar el diagnóstico, sin duplicado repro:

- Aceptación al precio original y rechazo: 12 conversaciones, con cierre DTO.
- Precio cambiado y respuestas «sí, el combo», «sí» o «Pepsi»: 18 conversaciones; se conserva el carrito, se avisa del nuevo precio y solo después de elegir nuevamente se recoge la bebida y se cierra el DTO.
- Combo agotado después de ofrecerlo: 6 controles de respuesta, carrito y ausencia de selección de atributos. No se acredita cierre con producto agotado.

Los 30 cierres simulados verifican dos unidades, producto, preparación y nota; los combos verifican bebida. Se verifica precio nuevo en carrito, además de no crear orden antes de confirmar. No se afirma que esta matriz valide cada campo monetario del DTO.

Foco nuevo: 36/36 (`/tmp/ppp-208-spec.json`). Guardas de combos, imágenes y componentes: 747/747; Falafel: 1/1. TypeScript general/build y Node 92/92 aprobados. Global final: **18.890 pruebas / 273 suites**, 580 hashes, 748,14 segundos; inventario exacto y fuente congelada. Evidencia: `/tmp/ppp-208-final-global-summary.json`. No se incluyen los diagnósticos opt-in fallidos en ese total aprobado.

## Próxima tanda

1. Retomar los doce fallos de oferta inicial en `whatsapp-implicit-combo-offer.repro.ts`: reconocer identidad completa y ofrecer variante compatible antes de separar componentes/bebida.
2. Reutilizar la propuesta existente solo después de una compra explícita del plato base, o modelar una propuesta sin compra correctamente; nunca fingir una línea original.
3. Conservar bebida ya solicitada, preparación, cantidad y nota al aceptar; negativa/compra aparte, volumen distinto y alternativas ambiguas deben tener controles independientes.
4. Mantener foco temprano de imágenes, Falafel, combos explícitos, componentes aparte y esta nueva guarda de precio; después global con fuente congelada.

Continúan pendientes telemetría integral por pedido/modalidad y medición real de ahorro. Esta tanda no consume API ni mide ahorro en dólares. No declarar vendible por conteos.
