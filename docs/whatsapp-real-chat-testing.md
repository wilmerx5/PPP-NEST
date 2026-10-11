# Corpus de chats reales: selección para regresiones

Fuente: 34 bloques compartidos por el usuario el 2026-10-10. Algunos bloques contienen varios días o incluso conversaciones distintas; un bloque no equivale a una sesión de prueba. La numeración original se repite: las referencias usan lote y número.

Los 14 escenarios seleccionados están en `scripts/fixtures/whatsapp-real-chat-patterns.json`. Solo se conservan mensajes necesarios; se sustituyeron ubicaciones y se excluyeron nombres, teléfonos, cuentas y coordenadas reales. El catálogo actual determina disponibilidad y precios. Las respuestas históricas del operador no constituyen resultados esperados.

## Cobertura inicial

Cuatro escenarios con `automated: true` se ejecutan en `whatsapp-general-accuracy.spec.ts`: consulta de precio con cantidad, referencia sin adjunto, consulta de total y agradecimiento. Se verifican carrito y respuesta cuando corresponde. El mismo archivo cubre por separado la preparación del plato y el barrio en mensajes sucesivos, incluyendo repetición del barrio; todavía falta extender esa conversación con la nota tardía «sin ensalada».

Las regresiones de cocción cubren el pedido inicial, corrección posterior con typo, conservación de otras notas, sustitución del término anterior y alcance ambiguo con otro catálogo. Una pregunta de alcance ambiguo no acredita que una respuesta posterior solo con el nombre retome la edición: ese recorrido sigue pendiente.

Estos tests usan router, catálogo y carrito reales con modelo, persistencia y transporte simulados. No prueban inferencia real, concurrencia, adjuntos ni sesiones entre días.

## Próxima tanda, en orden

1. Dirección por partes: calle → conjunto → torre/apartamento; luego corrección explícita de calle.
2. Instrucciones compuestas y tardías: sin salsas + más miel, cambio de acompañamiento, nota mientras se pregunta pago. No prometer sustituciones sin soporte del negocio.
3. Varios productos y variantes: pollo + sopa, consulta intermedia, elección; asegurar cantidades exactas y ausencia de duplicados.
4. Pedido multilínea con dirección, cantidades y consulta de total/tiempo. La ETA debe proceder de configuración o estado disponible.
5. Respuestas que citan opciones anteriores, typos de sabores y opciones agotadas: resolver solo dentro del catálogo y el contexto vigente.
6. Casos con dependencia especial: imagen ausente, canje validado, nueva sesión otro día y cancelación de pedido ya confirmado. Aclarar o derivar cuando falte contexto.

Los diez escenarios con `automated: false` son selección pendiente, no pruebas aprobadas. Antes de marcar cada uno como aprobado: ejecutar el recorrido completo, comprobar carrito/estado/respuesta y añadir variaciones con otro catálogo. Reservar variantes inéditas para evaluación; no copiar mensajes de prueba en reglas de producción.

## Ejecución y gasto

Rama de integración: `staging`. Seguir `AGENTS.md` para publicación y despliegue.

Pruebas focalizadas gratuitas:

```sh
npx jest src/whatsapp/whatsapp-general-accuracy.spec.ts --runInBand -t 'historical chat|described dish|cooking|steaks'
```

Después de cambiar reglas compartidas: `npx tsc --noEmit --incremental false` y `npm run test:whatsapp`.

Esta selección no realizó llamadas pagadas. El saldo autorizado se conserva en `docs/whatsapp-model-budget.json`; no ejecutar inferencia masiva sobre el archivo original ni reiniciar el presupuesto. Una suite verde no acredita que el producto esté listo para venta.
