# Tanda179: tres preguntas durante pago

Base: e88b88a1. Solo staging. Se cubre el límite superior de tres preguntas soportado desde178; no se cambió el funcionamiento.

## Matriz y contratos

24 recorridos con Bowl Vegetal, Pizza De Hongos y Ramen De Miso; agente simulado activado/desactivado, nombre/teléfono explícito, contacto antes/después de preguntas. Cada mensaje pregunta precio del plato, composición y demora del domicilio. Se exige respuesta a las tres, conservación del carrito de dos unidades con nota, contacto actualizado, petición de pago y ausencia de creación prematura. Tras contraentrega y confirmar, se valida una sola orden simulada con dos unidades, nota, contacto y dirección correctos.

## Evidencia

- Baseline: 24 casos nuevos aprobados; no fallo reproducido en este alcance.
- Foco final: 48/48, dos suites, 12,002 s; /tmp/ppp-179-focus.log.
- TypeScript general/build; /tmp/ppp-179-tsc-final.log.
- Node: 92/92; /tmp/ppp-179-node.log.
- Los 545 archivos de /tmp/ppp-178-hashes.json mantienen su hash. Última global ejecutada: 18.241 pruebas, 247 suites. La nueva suite se validó focalmente; no se repite global por ser solo pruebas/documentación.

## Límites y siguiente bloque

Modelo, tiempos y persistencia son simulados. No demuestra precisión real ni preguntas sin signos o ambiguas. La consulta parcialmente resoluble se propuso al inicio del turno, pero primero se cerró este hueco del límite de tres preguntas; queda pendiente, sin atribuirle cobertura.

Reproducir precio de plato explícito + precio de bebida ambiguo + contacto. Resolver lo conocido, conservar el contacto y encaminar la duda restante al mecanismo existente sin descartarla. Probar respuesta, estado pendiente y recuperación hasta DTO. Si cambia una regla compartida, ejecutar global con fuente congelada. No llamadas pagadas ni órdenes externas en esta tanda. Staging remoto desplegado hasta177; 178 aún pendiente. No modificación de Main.
