# Cantidades en aclaraciones de WhatsApp — PPP

Regresión reportada el 9 de octubre de 2026:

1. `Quiero Tres pillos` → pregunta por preparación.
2. `Fritos` → antes se agregaba uno en lugar de tres.
3. Después de reiniciar, el bot afirmaba haber agregado tres pollos sin reflejarlos en el carrito.
4. `Dos sopas` → pregunta por tipo; `Ajiaco` → antes quedaba una sopa y se perdían los pollos.

Un pedido genérico con varias opciones ahora abre una selección persistida antes de llamar al agente. Se guardan candidatos, intención de compra y cantidad. No se elige un SKU ni preparación arbitrariamente. La selección usa el catálogo actual y conserva el resto del carrito.

Las respuestas breves con cortesía (`fritos porfa`, `ajiaco porfa`) y la frase `los quiero fritos` se resuelven sobre esa selección. El número de fila conserva la cantidad pedida. Reiniciar elimina tanto el carrito como la selección y cantidad pendientes.

Las protecciones de AgentV1 y del orquestador reconocen `agregué` y `añadí` con tilde: una afirmación del modelo no sustituye una acción aplicada. Pedidos con cantidad sin acciones efectivas vuelven al flujo del catálogo para guardar la aclaración.

## Evidencia automatizada

- `src/whatsapp/whatsapp-clarification-turns.spec.ts`: 17 pruebas del enrutamiento real de entrada con mensajes separados, catálogo, guard y aplicación del carrito. Persistencia en memoria con copias al guardar/releer; respuesta del modelo y transportes aislados.
- `test/whatsapp.db.integration-spec.ts`: conversación completa por HTTP con firma válida y MariaDB real, leída desde otra conexión después de cada paso. Tres pollos y dos ajiacos persisten; repetir el ID de Meta del último mensaje no duplica las sopas ni envía otra respuesta.
- Suite de aplicación: 890 pruebas / 47 suites aprobadas localmente. TypeScript también pasa.
- Suite de persistencia y pedidos: 72 pruebas / 3 suites aprobadas con MariaDB 10.11.19 en Docker local.

Estas comprobaciones no llaman a OpenAI ni Meta, no envían mensajes a teléfonos y no certifican el despliegue de staging. La prueba MariaDB usa únicamente una base local desechable. El bot desplegado debe ejecutar este mismo candidato antes de repetir la conversación real.

## Aceptación pendiente en staging

Sobre un carrito de prueba identificado, comprobar `Quiero tres pollos` → `Fritos` → `Dos sopas` → `Ajiaco`: el carrito debe conservar tres pollos fritos y dos ajiacos, con precios del catálogo desplegado. Repetir con cortesía y comprobar que productos/notas anteriores siguen intactos. No cambiar el carrito del ensayo anterior sin identificarlo y acordar su continuación.

La aceptación general de beta sigue en `docs/whatsapp-beta-acceptance.md`: esta corrección no cierra por sí sola pagos, cocina, recuperación, cobertura ni operación completa.

## Ensayos secuenciales y productos repetidos del historial

El recorrido `Quiero dos sopas` → número de ajiaco → `Tres pollos fritos` → `No mas` → pago se verifica después de cada turno. La matriz cruza una/dos sopas, selección textual/numérica, orden de platos y carrito vacío/con sopa anterior: 16 conversaciones hasta `awaiting_final_confirm`. El carrito con una sopa anterior debe terminar con tres al pedir dos adicionales; empezar de cero debe terminar con dos.

Se reprodujo un bypass de la validación de nuevas líneas: si el modelo enviaba `addItems` y una edición/nota juntas, se conservaba una sopa repetida del historial. Las altas se validan contra el mensaje actual incluso en turnos con ediciones. En esos turnos no se infieren altas nuevas a partir de una referencia a un plato existente. También se persiste la selección para pedidos genéricos de una unidad y se rechaza `Solo era` como nombre.

La suite del enrutamiento tiene ahora 36 casos; la aplicación completa pasó 912 pruebas / 47 suites. TypeScript pasó. Se agregó una prueba HTTP/MariaDB con modelo adversarial, lectura independiente, duplicado de webhook, checkout y selección de pago; requiere CI de persistencia para validar el nuevo candidato.

El ensayo de staging amplía la batería a 27 pasos y conserva cantidades esperadas/reales en el reporte sin datos personales. El modo `known-soup-checkout-draft` ejecuta 28: valida el borrador exacto observado (tres ajiacos/tres pollos, último recorrido y estado de confirmación), lo reinicia según la autorización del usuario y ejecuta toda la batería. Se detiene ante cambios humanos o divergencias y conserva el estado que falló. La versión exigida es `2026-10-10.cart-v7`. Las 39 pruebas del corredor usan servicios simulados y no certifican el bot desplegado.

El 9 de octubre, el reintento de staging verificó despliegue cart-v6, firma, configuración y base conectada, pero detuvo la ejecución porque el usuario estaba en checkout: cero mensajes de prueba enviados. El candidato cart-v7 aún debe desplegarse antes de completar el ensayo real.

Para declarar el producto vendible todavía se requiere aceptación end-to-end de creación del pedido, cocina, pagos y recuperación, además de pilotaje supervisado. Los tests con modelo aislado y Meta simulado no sustituyen esa evidencia.
