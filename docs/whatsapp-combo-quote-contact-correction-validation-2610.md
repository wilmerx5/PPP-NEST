# Tanda 223 — negativas y contactos corregidos antes de aceptar

Base `d1246b17`, staging. Solo pruebas y documentación, sin cambios de runtime.

## Recorridos

30 conversaciones: tres menús sintéticos (arroz, bowl, pasta), agente simulado off/on y cinco caminos. Se cotiza una presentación grande con Agua a precio actualizado; el cliente envía nombre y teléfono; después dice «no», «no gracias», «sin combo», corrige nombre o corrige teléfono.

Las negativas deben limpiar la alternativa, conservar el plato original con dos unidades/notas/preparación/precio, conservar contacto y ofrecer continuación. En el fixture de recogida con datos completos la respuesta muestra carrito original y pregunta pago. Las correcciones de contacto mantienen la cotización y Agua; elegir la fila2 completa el reemplazo. Cada conversación cierra con DTO simulado que verifica productos, dos unidades, notas y nombre/teléfono finales.

## Evidencia

Primera ejecución:12 verdes y18 fallos del oráculo que exigía literalmente «conservo/como está/sigue igual». La salida correcta ya mostraba producto original, total40000 y pregunta de pago. Se sustituyó esa exigencia de redacción por comprobaciones de producto/ausencia de combo/importe/estado de pago. No se cambió runtime ni se relajaron carrito/datos/DTO. Foco final114/114 en cuatro suites,21,219s; TypeScript general aprobado.

No nueva global por test/docs únicamente. Última completa220:19.470/286 suites; no presentarla como run223. Evidencias privadas `/tmp/ppp-223-*`.

## Límites y continuación

No cubre negativas complejas («no ese, el otro») ni pregunta y elección sin puntuación. Siguiente: esos mensajes informales, referencias incompletas y conservación de opciones cuando el usuario cambia de opinión. Modelos simulados; no atribuir precisión real ni ahorro.

Cero API pagada/Meta/órdenes externas. Main/modelos intactos; publicación staging sin despliegue.
