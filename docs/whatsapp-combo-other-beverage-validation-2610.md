# Tanda 226 — otra presentación con bebida explícita

Base `67f93cef`, rama staging. Corrección general sobre alternativas pendientes, sin excepciones de restaurante.

## Reproducción y cambios

48/48 conversaciones inicialmente fallaban. «El otro con Agua» no resolvía la referencia relativa. La primera corrección dejó30 verdes/18 rojas: en los recorridos de aclaración o sabor inválido, «1 con Agua» tampoco resolvía la selección numerada.

La referencia relativa conserva ahora el complemento de bebida y lo lleva al validador habitual de opciones. Sigue exigiendo antecedente identificado y una sola alternativa distinta. Las referencias numéricas con bebida también se resuelven dentro de la lista pendiente. No se acepta un sabor inexistente, no se compra una alternativa agotada/retirada y los cambios de precio requieren aceptación.

## Cobertura

48 conversaciones: tres menús sintéticos (arroz, bowl, pasta), agente simulado off/on y ocho caminos: referencia única, cortesía, tres alternativas, ausencia de antecedente, precio cambiado, producto agotado, producto retirado y sabor inexistente. Cada recorrido verifica carrito, respuesta, elección pendiente, opciones, dos unidades, notas, precio y DTO de cierre simulado. Los casos ambiguos se recuperan con «1 con Agua»; los inválidos no alteran el carrito antes de una elección válida.

Foco168/168 en cuatro suites. Verificación adicional48/48 con aserciones explícitas de respuesta en elecciones directas. TypeScript general/build,92 controles Node y guardia Falafel aprobados. Global completa:19.692 pruebas/292 suites,599 hashes,758,54s; inventario exacto y fuente sin cambios. Evidencias `/tmp/ppp-226-*`.

## Límites y siguiente bloque

Se acredita selección relativa con bebida, no cualquier complemento libre tras «con». No acredita preguntas junto a negativas, corrección explícita de dos productos ni interpretación real del modelo (ambos modos usan mocks). Siguiente tanda: consultas de contenido/precio junto a rechazo o cambio de alternativa, garantizando respuesta y continuidad sin compra implícita.

Sin llamadas pagadas, Meta ni órdenes externas. Main y modelos intactos. Publicación en staging, sin despliegue; runtime210–226 pendiente de despliegue agrupado. No se midió ahorro real ni se declara vendible por conteos.
