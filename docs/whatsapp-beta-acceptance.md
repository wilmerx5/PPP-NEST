# PPP WhatsApp — Beta supervisada: checklist de aceptación

## Alcance y límites
- Objetivo: probar toma de pedidos reales **con supervisión**, antes de habilitar operación autónoma.
- Requisito de piloto: **una sola instancia del orquestador de WhatsApp**, con intervención humana y rollback disponible. No declarar soporte multiinstancia hasta disponer de serialización distribuida por `waId`.
- No reejecutar automáticamente mensajes `processing` antiguos o `failed`; algunas acciones pueden haber modificado el carrito o generado una orden antes de la caída.
- El CI valida lógica, simulaciones y persistencia WhatsApp en MariaDB desechable; **no sustituye pruebas de Meta real, el esquema desplegado, geocodificación, pagos ni creación de pedidos en staging**. Ver `docs/whatsapp-db-integration.md` y `docs/ppp-staging-test-requirements.md`.

## Requisitos técnicos previos al piloto
- [ ] Usar entorno aislado de staging con catálogo PPP fiel a producción y número de WhatsApp de prueba.
- [ ] Comprobar `UNIQUE(wa_message_id)` en `ppp_whatsapp_messages`, no solo confiar en el migrador. No iniciar piloto si falta.
- [ ] Verificar columnas `processing_status`, `processed_at`, `processing_error` creadas; respaldo previo de DB.
- [ ] Probar webhook firmado con `X-Hub-Signature-256` válido e inválido.
- [ ] Verificar que confirmar un pedido no realice cobros ni envíe pedidos a cocina real en staging.
- [ ] Disponer de desactivación rápida del bot y soporte humano.
- [ ] Registrar fecha, `waId` anonimizado, IDs de mensajes, carrito antes/después y pedido generado para cada fallo.

## Escenarios de aceptación (repetir con textos separados por burbujas)
1. Pedido sencillo: «un cuarto de pollo broaster»; confirmar presa/acompañamientos y total.
2. Plato ambiguo: «una pechuga», elegir variante explícita; no adicionar SKU por defecto.
3. Arroz chino genérico; listar presentaciones y pedir selección.
4. Dos platos y notas distintas: arroz con pollo sin ensalada + pechuga con yuca. Notas asociadas al producto correcto.
5. Domicilio dividido en calle + torre + apartamento; conservar dirección completa.
6. «Dos de cada una» con lista que incluye variante genérica; aclarar qué platos antes de agregarlos.
7. «No, son cuatro sopas: dos de ajiaco y dos de menudencias»; reemplazar, no sumar al error previo.
8. «Mucho ají» como observación, nunca como nombre del cliente.
9. Cambio de cantidad tras resumen; carrito final refleja la corrección una vez.
10. Reenvío idéntico de `wamid`: no duplicar carrito ni orden.
11. Lote A+B+reenvío de A: solo procesar A y B una vez.
12. Reenvío parcial: A ya procesado, B nuevo; procesar únicamente B.
13. Mensajes consecutivos de un mismo `waId`; verificar orden y no pérdida de estado.
14. Falla al enviar respuesta por Meta: estado `failed` y revisión manual (sin reejecución ciega).
15. Reinicio/cancelación de carrito; no recuperar productos descartados.
16. Confirmación repetida y timeout del cliente; verificar un solo ID de orden.
17. Producto agotado / catálogo actualizado; no vender indisponibles.
18. Cambio de dirección tras cotización de domicilio; recalcular y no reutilizar tarifa anterior.
19. Cliente pregunta por estado de pedido ya enviado; no abrir pedido nuevo.
20. Takeover humano; impedir respuestas automáticas mientras esté activo.
21. Dos sabores del mismo SKU: cambiar o quitar el primero conserva el segundo y sus cantidades.
22. Dos notas del mismo SKU: añadir o borrar una nota no afecta la otra línea.
23. Reemplazar un plato y añadir una nota en el mismo turno; el agente puede ver el nuevo producto.
24. Editar cantidad respeta límites; unir variantes iguales conserva todas las unidades.
25. Preparación/sabor declarado como opción no se guarda solo como nota.
26. Producto retirado del catálogo: se puede quitar del carrito para continuar.
27. Precio cambiado después del resumen: revisar el nuevo total antes de crear el pedido.
28. Verificar en el payload de cocina cada variante, nota y unidad, no solo el número de eventos.

## Criterio de salida beta
- CI completo verde en el SHA a fusionar.
- Cero órdenes duplicadas, cero órdenes no autorizadas, cero cambios de carrito silenciosamente perdidos en pruebas de staging.
- Todos los escenarios críticos anteriores documentados como PASS/FAIL con evidencia.
- Verificar rollback y desactivación del bot.
- Ensayo supervisado antes de tráfico normal.

## Registro de fallos sugerido
`Caso | Fecha | Mensajes (anonimizados) | Esperado | Observado | Pedido ID | Severidad | Link al issue`

**Severidad P0:** orden duplicada/incorrecta enviada a cocina, cobro inesperado, pérdida silenciosa de mensajes.
**P1:** variante/nota/cantidad/dirección incorrecta antes de confirmación.
**P2:** respuesta poco natural, exceso de mensajes, latencia o experiencia mejorable.

## Piloto y siguiente producto

Usar [ppp-pilot-readiness.md](ppp-pilot-readiness.md) para registrar métricas, revisar los primeros 100 pedidos y definir condiciones de interrupción. El piloto es supervisado y comienza después de cerrar los requisitos externos; este checklist no autoriza despliegues ni mensajes a clientes. La aceptación PPP precede a la validación de Kamppo con varios restaurantes.
