# Tanda283 — exclusiones coordinadas con «ni»

Derivada de los patrones de notas y correcciones de los chats compartidos y del límite documentado en281/282. Son variantes sintéticas; no se añadieron audios ni PDFs nuevos y no se afirma cobertura completa del corpus.

## Reproducción

Los312 recorridos iniciales dieron144aprobados/168fallidos. Los36límites puros dieron11aprobados/25fallidos. «Sin cebolla ni tomate» podía pasar como una nota indivisible para conflictos, por lo que «con tomate» no se consideraba contradictorio; las frases largas con3ingredientes tampoco abrían siempre la selección correcta.

## Cambio

La misma gramática acotada reconoce dos/tres exclusiones con«y sin» o«ni» y entrega las frases completas de ingredientes. El parser de unidades y el de notas sin destino usan esa gramática. La comprobación de incompatibilidad reconoce los ingredientes coordinados sin confundir«tomate» con«salsa de tomate». Se conserva la redacción de la nota en el carrito; no se sustituye por una compra ni se eliminan otras indicaciones.

## Cobertura

Dos catálogos ajenos a PPP y agente simulado activo/inactivo:128selecciones por número/nombre/ordinal,48divisiones de una unidad,64conflictos con el segundo ingrediente,64interrupciones y8recuperaciones. Los36casos puros comprueban aceptación, rechazo de comandos/cantidades/condiciones y conflicto en ambos sentidos, con controles que conservan frases de ingredientes distintas.

Total348nuevas. El foco incluye408regresiones vecinas:756aprobadas. Los recorridos compran por el router y verifican carrito, estado, respuesta y ausencia de órdenes externas. No hay inferencia real, Meta ni entrenamiento automático. No acredita toda forma regional de exclusión ni los fallbacks del modelo para frases inválidas.
