# Tanda 219 — disponibilidad entre recotización y aceptación

Base `17199282`, staging. Esta tanda añade cobertura; no modifica reglas compartidas ni modelos.

## Recorridos

18 conversaciones con router completo: tres menús sintéticos (arroz, bowl, pasta), agente simulado activado/desactivado y tres cambios de catálogo después de cotizar una presentación grande con Agua:

- Agua se retira de las opciones: aceptar el precio conserva el carrito original y abre la elección de bebida vigente. Elegir Pepsi termina el reemplazo.
- El combo queda no disponible: aceptar no lo agrega; se informa la indisponibilidad y se permite elegir la presentación pequeña.
- El combo se elimina del catálogo: misma conservación y recuperación mediante otra opción ofrecida.

Se comprueban respuestas del turno, carrito antes de aceptar y durante la aclaración, estados building_cart/awaiting_attribute/completed, cantidades, precio vigente, notas y atributos; cada recorrido completa dos unidades en un DTO de orden simulado, sin orden externa. El caso de sabor retirado exige elección explícita: no acepta sustituir Agua silenciosamente por Pepsi.

## Evidencia

Baseline: 18/18 aprobadas sin cambiar runtime. Foco: 162/162 en cuatro suites, 24,699s; TypeScript general aprobado. Snapshots privados `/tmp/ppp-219-*`, sin datos de clientes reales. No repetir global: solo se añade una suite y documentación, sin cambios compartidos. La global previa es la evidencia combinada de tanda218; no atribuir sus resultados a un nuevo run.

## Límites y siguiente tanda

La aceptación cubierta aquí es «sí». Falta repetir estas transiciones mediante número/código/nombre y comprobar que esos caminos también conservan la bebida explícita o piden reemplazo al retirarla. Después: consultas y contactos durante la aceptación. No acredita proveedor real, disponibilidad real ni ahorro de API. Cero llamadas pagadas/Meta/órdenes externas. Main intacta; sin despliegue.
