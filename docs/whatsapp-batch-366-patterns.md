# Tanda366: opciones y notas de varios productos cotizados

## Fallo reproducido

La tanda365 dejó pendiente comprobar cantidades cotizadas cuando hay que elegir opciones. En una cotización de dos productos, después de aceptar y responder la opción del primero, desaparecía el segundo pendiente. La creación de la pregunta retiraba el primer producto de la cola y la finalización volvía a retirar una entrada, saltándose el siguiente. Además, cada producto recibía el texto completo de la cotización, mezclando contexto de cantidades, notas y opciones.

## Cambio

La aceptación conserva el producto activo en la cola hasta completar sus opciones. La finalización existente lo retira por ID. Cada producto recibe su propio segmento usando el delimitador de catálogo existente. Se pregunta por los sabores obligatorios uno por uno, mientras los atributos que ya admitían valores por defecto mantienen esa política. No se cambian las opciones predeterminadas del restaurante.

## Pruebas

80 regresiones nuevas:64 recorridos combinan dos catálogos × agente off/mock × cantidades2/3 y3/1 × con/sin notas × platos/bebidas × respuesta por nombre/número. Los numéricos incluyen interrupción con menú. Se comprueban texto de pregunta, estado, carrito, cantidad, precio, opciones y separación de notas; cierre DTO con80 órdenes simuladas en toda la suite.16 recorridos adicionales prueban opciones explícitas del primero/segundo/ambos y tres productos consecutivos. Foco224/3 aprobado.

La reproducción final ejecutó exactamente esos80 controles sobre la versión365:76 fallaron y4 ya pasaban. La exploración inicial16/16 también detectó la pérdida del segundo; su expectativa de preguntar otra vez por una bebida con valor predeterminado se corrigió antes de la comparación final. No se presenta esa expectativa inicial como requisito nuevo.

## Estado y límites

Global34642/434 aprobada, sin fallos ni omitidas;652 fuentes congeladas e inventario exacto. TypeScript general/build y scripts aprobados; despliegue366 pendiente. Código congelado durante la global. Pruebas con router real y dependencias externas simuladas; cero inferencia pagada, Meta u órdenes externas. Presupuesto267/256/11 intacto. Producción349 y motor Kamppo321 sin cambios.

Siguiente: interrupciones/cancelación y disponibilidad del producto siguiente durante la selección; compatibilidad de ofertas antiguas y consultas largas. Esta tanda no acredita modelos/canales reales ni cubre todas las formas regionales de pedir.
