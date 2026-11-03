# Tanda372: aclaración de cantidades y continuidad de checkout

Derivada de los casos de reparto del01/11 (438–447) y del pendiente identificado en371. Usa carritos preparados con dos líneas del mismo producto, distintas sopas/notas y un postre independiente; no es reproducción literal del chat original.

## Fallos reproducidos

1. Con el pedido en revisión final, pedir cambiar una cantidad ambigua y responder la línea actualizaba el carrito, pero volvía a building_cart/«¿algo más?». Baseline inicial4/4 fallan en la transición. Se conserva awaiting_final_confirm y se muestra total recalculado con una nueva petición de confirmación. No confirma automáticamente ni reutiliza enlaces de pago externos.
2. La respuesta «sin ensalada» no seleccionaba la línea con esa nota. La selección pendiente ahora tiene prioridad frente a las rutas de notas nuevas cuando no hay otras selecciones abiertas. La coincidencia exacta de nota conserva polaridad; preguntas y notas duplicadas no eligen una línea.

## Evidencia

Código `019fbf55ccd238e42f356a2aedaf6564be6f9488`. Baseline final:28/68 fallan y40 controles ya pasaban (respuesta/estado/carrito; no28 pérdidas de productos).68 casos:32 recorridos de selección (dos catálogos × agente off/mock × compra/revisión final × número/ordinal/sopa/nota),24 interrupciones (consulta total/opción compartida/carrito obsoleto) y12 controles de nota (polaridad contraria/pregunta/duplicación).48 cierres DTO simulados verifican cantidades, notas, bebida y postre independiente. Foco final273/4 aprobado. Global inicial interrumpida tras6 fallos con selección incompleta; corregida la entrada para exigir lista de opciones válida. Global final: 34920 pruebas / 440 suites aprobadas; 658 fuentes congeladas e inventario exacto. TypeScript general/build y scripts aprobados. Despliegue staging pendiente.

## Límites y siguiente tanda

Este avance cubre una cantidad para una línea elegida. La petición compuesta de371 con cantidades para varias preparaciones aún puede requerir que el cliente reformule por línea: no se declara resuelta toda esa redistribución. Siguiente: cantidades por varias líneas en una frase, respuestas completas a la aclaración y conservación de opciones; después notas en varios platos del corpus. Los duplicados históricos sin reproducción requieren trazas.

Cero inferencia pagada, Meta u órdenes externas; presupuesto267/256/11 intacto. Producción349/Kamppo321 sin cambios. Pruebas con modelo/canal/persistencia simulados.

## Caso prioritario para373 (diseño, sin ejecutar)

Carrito: frito con ajiaco ×4, frito con menudencias ×3, broaster ×1. Cliente: «solo eran3fritos y uno broaster». La aclaración debe distinguir el total del frito de la cantidad de una línea. Respuesta candidata: «dos con ajiaco y uno con menudencias». Resultado esperado:2+1+1, nunca2+3+1 ni3+3+1. Mantener opciones/notas y revisar total antes de confirmar. Añadir controles de suma discordante, otra preparación, respuesta duplicada y carrito cambiado. La respuesta por una sola línea no permite inferir automáticamente el reparto restante.
