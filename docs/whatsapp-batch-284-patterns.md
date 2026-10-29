# Tanda284 — notas incompatibles en pedidos de varias unidades

Origen: continuación del plan de correcciones parciales y patrones compartidos de varios ejecutivos con preparaciones distintas. Los casos nuevos son variantes sintéticas; no se incorporan PDFs/audios nuevos ni se afirma aprendizaje automático.

## Fallo reproducido

«Uno de los3[plato] sin cebolla ni tomate y los otros2normales» podía dividir una línea con«con tomate» y guardar ambas notas contradictorias en la unidad separada. Una nota dirigida a todas las unidades también podía modificar todo el carrito aunque uno de los platos tuviera una indicación incompatible.

Baseline320recorridos:160pasaron y160fallaron. El cambio valida las notas anteriores de todos los destinos antes de dividir o añadir. Si encuentra conflicto, no modifica productos, cantidades, precios ni notas; identifica el plato y la indicación anterior. No crea una selección nueva ni interpreta la contradicción como autorización para reemplazar la nota.

## Cobertura

-192divisiones parciales:2menús ×2modos de agente simulado ×2estados ×4notas ×3cantidades ×2condiciones (compatible/conflicto).
-128notas de todo el carrito:2menús ×2modos ×2estados ×4notas ×2distribuciones de cantidad ×2condiciones.

Las notas incluyen exclusión simple,«ni» y«y sin», con ingredientes de varias palabras. Se compran productos por el router y se cargan notas previamente guardadas como fixture de sesión; no se acredita aquí cómo se originó esa nota anterior. Cada conflicto comprueba una petición posterior compatible. Todas las pruebas verifican carrito completo, estado, respuesta y ausencia de órdenes externas.

No añade resolución inferida entre unidades, sustitución de variante ni retirada ambigua. Tampoco cubre toda contradicción posible del lenguaje; conserva el detector acotado de ingredientes. Las regresiones vecinas y globales verifican el resto de comportamiento existente. Inferencia, Meta y órdenes externas permanecen simulados.
