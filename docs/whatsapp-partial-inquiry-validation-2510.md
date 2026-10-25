# Tanda180: respuesta parcial y contacto

Base 474f66bb, solo staging. En un mensaje con consulta de precio nombrando un producto, segunda consulta de precio sin identificar plato y nombre/teléfono explícito, el flujo anterior perdía la respuesta conocida o el contacto.

## Reproducción y corrección

24 recorridos: tres menús sintéticos (bowl, pizza, ramen), agente simulado on/off, nombre/teléfono y preguntas antes/después del contacto. Baseline final sin corrección: 24 fallos, 20,442 s; /tmp/ppp-180-baseline-final.log. Después: 24 aprobados, 11,027 s; /tmp/ppp-180-focus2.log. Las suites178/179 también pasaron en el primer foco (48); ese primer foco falló en los nuevos casos porque «cuánto cuesta» admite respuesta sobre total. El escenario final utiliza «cuánto cuesta ese plato» y verifica aclaración de producto.

Se conserva el dato explícito usando los servicios de persistencia existentes, se responde y confirma el contacto, y se devuelve la única pregunta no resuelta al router normal. No se inventa respuesta ni se agrega producto. La aclaración posterior de precio usa la lista existente; seleccionar2 consulta la bebida, no el método de pago. Luego contraentrega/confirmar crea una sola orden simulada con tres unidades, notas, contacto y dirección correctos.

## Límites

Este bloque acredita dos preguntas delimitadas y nombre/teléfono durante pago. No acredita dirección mezclada, varias dudas sin resolver ni modelo real. No APIs pagadas, Meta ni órdenes externas. Main/producción intactas. No declarar listo para venta por conteos.

## Validación

TypeScript general/build y Node92/92 aprobados. Global aprobada: 18.289/18.289 pruebas, 249 suites, 547 hashes, 739,36 s; inventario exacto y fuente congelada. /tmp/ppp-180-global-summary.json y /tmp/ppp-180-*.log. Publicación en rama staging; sin desplegar. Servidor sigue hasta177; agrupar178–180 en próximo despliegue.

Siguiente: múltiples dudas pendientes y preguntas con dirección, conservando validación de mapa separada de captura textual. También probar interrupción de la aclaración por otra consulta o cambio de opinión.
