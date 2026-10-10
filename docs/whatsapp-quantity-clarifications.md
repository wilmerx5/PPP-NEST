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
