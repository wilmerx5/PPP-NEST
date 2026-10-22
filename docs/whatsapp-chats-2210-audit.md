# Auditoría de chats del 22/10 — tanda 106

Base: d1020db1, staging. No promover Main en esta tanda.

## Qué ya estaba corregido

- Preguntas de sopa con un pollo en el carrito: tanda 105. Reejecución inicial: 63/63.
- Opciones repetidas de ejecutivo: tanda 102; deduplicación por identidad del catálogo, conservando categorías.
- Bebida compartida entre dos combos: tanda 103; el alcance “los dos” no debe ser un producto ni afectar una sola línea.
- Dirección numerada con letras separadas y referencia: tanda 101. Se agregó exactamente “carrera 81 h 51 a 39 sur, frente al parque” a los casos de routing y checkout con Google simulado. Normalizar la consulta, conservar la referencia y rechazar otra puerta o partial_match.

## Hallazgo nuevo y corrección

Se extendieron las preguntas a “X de que tienes hoy” y “bueno y de que X tienes?” en Sopas, Jugos y Postres, agente on/off. Baseline: 253/255; falla “postre de que tienes hoy” en ambos modos, con agente devuelve la ficha de pizza. findAskedCategory ahora reconoce el nombre de categoría antes de “de qué tienes”, consultando categorías reales del menú. No añade nombres de productos de PPP al runtime.

16 comprobaciones nuevas: 12 de categoría y 4 de dirección. Foco corregido: 255/255 (4 suites). Las pruebas simulan modelos, mapas y mensajería: no prueban precisión actual de Google ni del modelo real.

## Pendientes prioritarios, no declarados resueltos

1. Sustitución completa: combo con costillas y 7up → combo con medio pollo broaster y 7up. Reproducir el recorrido con catálogo real sanitizado y otros menús. Verificar eliminación del anterior, un único nuevo combo, opciones conservadas y ausencia de notas “quita”/“con medio broaster y up”. Probar “quita el de…” frente a compra adicional explícita. La tanda 104 de oferta de combos no acredita este recorrido.
2. Afirmaciones sobre dirección: después de fallo de geocodificación, el cliente protesta y el modelo dice “ya está confirmada”. replyClaimsCartChange no cubre expresamente esta afirmación. Reproducir respuesta libre y acciones parciales; nunca acreditar ubicación/cobertura por el texto del modelo. Preservar dirección y referencia, pedir solo dato útil pendiente y no crear orden sin los requisitos.
3. Selección numérica de combo conserva la bebida del origen cuando es compatible; caso pendiente documentado desde 104.
4. Completar cada recorrido hasta DTO simulado y respuesta: los tests nuevos de dirección de esta tanda comprueban routing, sesión y composición de dirección, no creación de orden.

## Despliegue

Al iniciar la auditoría, staging ejecutaba 32e7f2ac (tanda 105), imagen aaa198cd…, saludable; Main no incluye las tandas 95–105 según el relevo vigente. Esta ampliación local no implica despliegue ni promoción. Agrupar despliegue tras validación.

## Validación final

Foco: 255/255. TypeScript general y build sin errores. Scripts Node: 92/92. Global: 80/80 secuenciales + 15.697/15.697 en cuatro workers; unión exacta del inventario actual de 189 suites, 487 hashes sin cambios. Duraciones: 68,129 s + 470,679 s. No se repitió ninguna fase. Logs locales: /tmp/ppp-t106-{bursts,rest}.json; /tmp/ppp-chats-2210-final.log. Sin llamadas pagadas, WhatsApp ni órdenes externas.
