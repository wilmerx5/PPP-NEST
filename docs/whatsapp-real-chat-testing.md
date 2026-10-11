# Corpus de chats reales: selección para regresiones

Fuente: 34 bloques compartidos por el usuario el 2026-10-10. Algunos bloques contienen varios días o incluso conversaciones distintas; un bloque no equivale a una sesión de prueba. La numeración original se repite: las referencias usan lote y número.

Los 14 escenarios seleccionados están en `scripts/fixtures/whatsapp-real-chat-patterns.json`. Solo se conservan mensajes necesarios; se sustituyeron ubicaciones y se excluyeron nombres, teléfonos, cuentas y coordenadas reales. El catálogo actual determina disponibilidad y precios. Las respuestas históricas del operador no constituyen resultados esperados.

## Cobertura inicial

Siete escenarios con `automated: true` se ejecutan en `whatsapp-general-accuracy.spec.ts`: consulta de precio con cantidad, referencia sin adjunto, consulta de total, agradecimiento, dirección por partes, salsas compuestas y consulta intermedia de sopa. Se verifican carrito y respuesta cuando corresponde. El mismo archivo cubre por separado la preparación del plato y el barrio en mensajes sucesivos, incluyendo repetición del barrio; todavía falta extender esa conversación con la nota tardía «sin ensalada».

Las regresiones de cocción cubren el pedido inicial, corrección posterior con typo, conservación de otras notas, sustitución del término anterior y alcance ambiguo con otro catálogo. Una pregunta de alcance ambiguo no acredita que una respuesta posterior solo con el nombre retome la edición: ese recorrido sigue pendiente.

Estos tests usan router, catálogo y carrito reales con modelo, persistencia y transporte simulados. No prueban inferencia real, concurrencia, adjuntos ni sesiones entre días.

## Próxima tanda, en orden

1. Pedido multilínea con dirección, cantidades y consulta de total/tiempo. La ETA debe proceder de configuración o estado disponible.
2. Respuestas que citan opciones anteriores, typos de sabores y opciones agotadas: resolver solo dentro del catálogo y el contexto vigente.
3. Completar la conversación de preparación → variante → dirección → nota tardía y los cambios de acompañamiento. No prometer sustituciones sin soporte del negocio.
4. Pollo sin estilo + sopa: preguntar frito/broaster sin perder la segunda elección. La prueba actual de interrupción hace explícito «frito».
5. Casos con dependencia especial: imagen ausente, canje validado, nueva sesión otro día y cancelación de pedido ya confirmado. Aclarar o derivar cuando falte contexto.

Los siete escenarios con `automated: false` son selección pendiente, no pruebas aprobadas. Antes de marcar cada uno como aprobado: ejecutar el recorrido completo, comprobar carrito/estado/respuesta y añadir variaciones con otro catálogo. Reservar variantes inéditas para evaluación; no copiar mensajes de prueba en reglas de producción.

## Ejecución y gasto

Rama de integración: `staging`. Seguir `AGENTS.md` para publicación y despliegue.

Pruebas focalizadas gratuitas:

```sh
npx jest src/whatsapp/whatsapp-general-accuracy.spec.ts --runInBand -t 'historical chat|described dish|cooking|steaks'
```

Después de cambiar reglas compartidas: `npx tsc --noEmit --incremental false` y `npm run test:whatsapp`.

Esta selección no realizó llamadas pagadas. El saldo autorizado se conserva en `docs/whatsapp-model-budget.json`; no ejecutar inferencia masiva sobre el archivo original ni reiniciar el presupuesto. Una suite verde no acredita que el producto esté listo para venta.

Actualización: dirección calle → conjunto → torre/apartamento ya tiene una prueba ejecutable. Regresiones adicionales verifican que se conserve el paso de checkout, que una calle explícitamente distinta reemplace la anterior y que una exclusión tardía se aplique con agente habilitado o deshabilitado. La conversación completa de preparación y los cambios de acompañamiento siguen pendientes.

Actualización: se conservan «sin salsas, en vez de salsas más miel» en el plato y «sin tanto recado» al resolver la sopa de un pedido múltiple. También se comprueba el mismo comportamiento con un bowl de otro catálogo. El caso de pollo+sopa hace explícito el estilo frito para aislar la interrupción; no acredita automáticamente el caso de pollo sin estilo. La respuesta ante producto inexistente incluye la negativa antes del menú, con regresión «mazorca da» y control de otro restaurante que sí vende mazorcada. Todas estas comprobaciones usan inferencia simulada; esta tanda no consume llamadas pagadas.

Verificación de esta tanda (2026-10-10): suite general 58/58, 1.285 pruebas; tras añadir el control de consulta de preparación, suite afectada 77/77 y TypeScript sin errores. El modelo está simulado en estas pruebas. El saldo de solicitudes pagadas permanece en 12.
