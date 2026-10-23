# Continuación después de tanda140

Estos son huecos de evidencia de las últimas conversaciones completas; no significan que no existan pruebas aisladas anteriores. Antes de añadir casos, localizar suites relacionadas y evitar duplicarlas cambiando solo nombres. No modificar fuente ni ejecutar otra suite mientras global140 esté activa.

1. Condición + acción independiente: «esa bebida si no cuesta más; aparte quita la segunda porción». Cumplir solo acción independiente, explicar condición pendiente, conservar unidad y opción originales. Contrastar con «quita la porción si no cuesta más», que no autoriza quitar incondicionalmente.
2. Dos opciones del mismo producto: elegir salsa y base en turnos distintos, preguntar precio entre ellas, dar teléfono antes de terminar. Verificar qué atributo recibe cada número, que no reaparezca el anterior y que la orden conserve ambos.
3. Reparto de unidades y corrección: tres unidades, dos con opciónA y unaB; después «solo una de lasA sin cebolla». Verificar tres unidades y nota en una, sin trasladar nota aB. Recuperar si hay dos líneasA con notas distintas mediante aclaración.
4. Selección retirada o menú cambiado durante consulta: conservar intención/cantidad, no usar código de otra lista ni prometer alternativa agotada. Permitir precio, cancelar selección y volver al carrito.
5. Datos y selección juntos en lenguaje natural: bebida, teléfono y nueva dirección en una frase con conjunciones; consulta sobre costo no es nombre ni dirección. Distinguir selección explícita y condicional.
6. Cierre y respuesta tardía: un mensaje posterior a confirmar no debe alterar la orden externa ni iniciar automáticamente otra; si es consulta debe responder estado pertinente. Simular duplicados y mensaje atrasado con mecanismo real del harness apropiado.

Por bloque: tres estructuras de catálogo distintas cuando importe (un atributo, dos atributos, atributo más extra vendible), dos variantes representativas antes de multiplicar matriz. Preferir conversaciones desde cero y terminar en DTO simulado/cancelación. Aserciones de respuesta, estado, carrito, cantidades/notas/opciones por unidad y cero órdenes antes de confirmar. Agente simulado on/off no equivale a dos modelos reales. Si falla, conservar original y clasificar fallo de producto frente a fixture.

Eficiencia: foco y suites vecinas primero. TS/Node según cambios. Una sola global con fuente congelada cuando cambien reglas compartidas; tests/documentación solos no requieren repetirla. Agrupar despliegues de staging. No tocar Main por continuidad rutinaria.

La validación con modelo real está pendiente, no debe posponerse indefinidamente por seguir sumando fixtures. Tras estabilizar los bloques de interrupción, ejecutar el plan whatsapp-api-validation-next-2310.md con presupuesto explícito y reporte de costo/latencia; el saldo operativo del registro no representa el saldo de la cuenta. Evaluar muestras nuevas y detenerse ante fallo crítico. Los casos corregidos pasan a desarrollo y dejan de ser muestra reservada. Mapas/voz/visión requieren evidencia específica, no se infieren de estos tests.
