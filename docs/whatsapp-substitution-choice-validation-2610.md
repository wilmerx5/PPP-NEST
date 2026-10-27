# Tanda 235 — sustitución de acompañamiento con dos alternativas

Base `0e2b4fc9`, staging. Dependencias externas simuladas; sin API pagada, Meta, mapas ni órdenes externas. Main y modelos intactos.

## Cambio

El pedido largo del 25/10 conservaba ya la sopa independiente y el ejecutivo, pero perdía «En ves de ensalada más papa o yuca». Se reconoce una sustitución delimitada, ligada a una línea de compra explícita, y se conserva como preparación pendiente. El bot pregunta cuál alternativa prefiere. Al responder, anota una solicitud únicamente en el plato correspondiente. No añade guarniciones cobradas ni promete disponibilidad del cambio. Retirar la indicación conserva las compras; cancelar el pedido limpia ambas. Confirmar con la alternativa pendiente no crea una orden.

Se reutiliza el estado de preparación pendiente, con metadatos de sustitución. El reconocimiento se basa en estructura de frase y catálogo; no depende de IDs o nombres de PPP. La resolución acepta el nombre de la alternativa y formas como «prefiero …», «con …», «mejor …», «dame …»; solo las formas probadas explícitamente quedan acreditadas.

## Pruebas

28 casos nuevos:18 conversaciones (tres menús × agente simulado off/on × primera/segunda alternativa/retirar nota), seis controles de parser y cuatro recorridos del mensaje real (agente simulado off/on × cerrar/cancelar).

Los recorridos comprueban productos/cantidades, pregunta, conservación del pendiente al consultar precio, bloqueo de confirmación prematura, nota por producto, destino y DTO de orden simulada. La comprobación de consulta de precio acredita conservación del pendiente, no una evaluación semántica exhaustiva de todas las respuestas informativas.

Primera reproducción:18 conversaciones fallidas y6 controles de parser verdes. Tras el cambio se detectaron errores en los oráculos del DTO: cada unidad se representa como un elemento, y el carrito se limpia al completar. Se corrigió el oráculo contra ese contrato y se verifica la nota en la orden. No contar esas aserciones como fallos productivos.

Foco:175/175 en cuatro suites. TypeScript general/build, Node92/92 y Falafel1/1 aprobados. Global completa:19.952 pruebas/304 suites,613 hashes,775,93s; inventario exacto y fuente congelada. Evidencia local /tmp/ppp-235-final-global-summary.json, reportes burst/rest y /tmp/ppp-235-focus.json.

## Límites y siguiente tanda

Alcance inicial: carrito nuevo, un único pedido de sustitución con dos alternativas, plato identificado y línea única. No acredita múltiples sustituciones simultáneas, alternativas para líneas ya divididas, disponibilidad real de cocina, todas las paráfrasis ni inferencia real. El patrón admite «en vez/ves de X más/por Y o Z»; no toda expresión alternativa.

El chat largo concreto queda probado en simulación incluyendo cancelación o elección de yuca y cierre. Esto no cierra los otros diagnósticos históricos: revisar reparto2→3, adicionales omitidos, cambios de cantidad/negación y reemplazos que agregan. Ampliar luego la familia de sustituciones a carrito existente y líneas divididas con destinatario inequívoco, conservando preguntas de precio/contenido y sin pendientes obsoletos al quitar el plato.

Publicación solo staging tras validación; sin despliegue en esta tanda. No declarar vendible por conteos.
