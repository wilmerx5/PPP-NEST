> Revisión de trazabilidad 26/10/2026 (tanda233): este documento conserva resultados históricos. Haber leído el set o corregido una familia no acredita todos sus recorridos completos. Consultar `whatsapp-profile-final-confirmation-validation-2610.md` y el inicio de `WHATSAPP-LOCAL-NEXT-AGENT.md` para estado actual. No interpretar diagnósticos rojos antiguos como resultados actuales sin reejecución, ni la global verde como cierre de los diagnósticos opt-in.

# Chats reales de la tarde/noche del 25/10: auditoría y siguiente corrección

Base: staging 4355f281; auditoría durante tanda194. Dos adjuntos del usuario, tres conversaciones. Datos personales omitidos. No se atribuye la versión del servidor a este SHA: los patrones se reprodujeron por separado en el router local.

## Lo que funcionó

- Cambiar teléfono durante pago y combinar nombre/teléfono sí funcionó en varios tramos.
- La dirección explícita permitió recalcular domicilio después de un destino incorrecto.
- Tras reiniciar y pedir explícitamente el combo de arroz con medio pollo, se conservaron bebida y preparación hasta el cierre.
- Las compras explícitas adicionales de pollo y papa funcionaron en algunos tramos. Esto no compensa los errores de carrito previos.

## Fallos prioritarios

1. **Cantidad y marca numérica.** «Arroz chino con medio pollo frito y gaseosa 7 up» produjo arroz independiente y siete medios pollos. La corrección posterior añadió el combo sin sustituir los productos erróneos; quitar «medio pollo» eliminó el combo. Se necesita proteger nombres/opciones numéricos del catálogo al extraer cantidades y resolver sustituciones por producto padre, conservando bebida. No basta reemplazar literalmente una marca.
2. **Negación convertida en compra.** «No va la gaseosa de 400 ml ni la porción de arepas» añadió arepas. Repetir la negación volvió a modificar el carrito. Debe interpretarse como eliminación de ambas líneas independientes, sin tocar componentes del combo; si no están, reconocerlo sin añadirlos ni abrir sabores.
3. **Cortesía convertida en dirección.** «Para que porfa para 1 domicilio» se guardó como destino y apareció con tarifa. Una intención de domicilio sin lugar debe preguntar dirección. Las pruebas locales acreditan extracción/confirmación indebida, no precisión del proveedor real de mapas.
4. **Reparto de dos sopas.** La compra pedía dos sopas calientes con acompañamientos diferentes; añadió arroz aparte y perdió las notas. La reformulación afirmó cambiar el acompañamiento, pero los carritos posteriores no lo reflejaron. Hay que preservar dos unidades, nota común de temperatura y nota/opción de cada unidad. Si una porción adicional pagada es ambigua, aclarar ese alcance sin prometer cambios ni perder el pedido.
5. **Corrección incompleta y respuesta falsa.** No decir «corregido» hasta comprobar el carrito persistido. Comprobar también recibo/DTO: que no se vean notas en el recibo por sí solo no demuestra que cocina no las recibió.
6. **Destinatario fuera de orden.** «Para [persona]» no actualizó el nombre en un tramo. Distinguirlo de destino, registrar el cambio y retomar pago.

## Evidencia ejecutable y límites

`src/whatsapp/whatsapp-evening-chats-2510.repro.ts`: ocho diagnósticos opt-in, cuatro patrones × agente simulado apagado/encendido. Resultado inicial **8 fallidos / 0 aprobados**, 28,908 s; `/tmp/ppp-194-newchats.json`. Los snapshots locales `/tmp/ppp-194-chat-*.json` guardan respuesta, carrito, sesión y estado. No forman parte del inventario verde ni son replay completo de los tres chats. El mock del agente devuelve cero acciones: no mide inferencia real. Cero API pagada, Meta u órdenes externas.

Ejecutar aisladamente:

```sh
npx jest --testRegex='whatsapp-evening-chats-2510\.repro\.ts$' --runInBand --silent
```

## Plan de tandas

- Primero negación múltiple: checkout y compra, productos presentes/ausentes, repetición, mezcla consulta/eliminación; tres menús, respuesta/cart/estado y DTO. Evitar que códigos/nombres de componentes seleccionen el combo equivocado.
- Después nombres numéricos y compra de combo con bebida: cantidades delante del producto, marca con espacio, volumen, corrección y eliminación específica. Catálogos sintéticos con nombres numéricos, sin excepción PPP.
- Dirección/cortesía: sin lugar no geocodificar; dirección real + referencia + persona + teléfono en distinto orden; no confirmar mapa por almacenar texto.
- Sopas/reparto: dos unidades con notas distintas, nota común, cambio posterior de una unidad y preguntas durante checkout, sin duplicados. Menús variados y ambigüedad de adicional pagado explícita.
- Reproducir después los chats completos, no solo patrones aislados. Promover cada diagnóstico a regresión verde solo tras corregir y ampliar controles. Ejecutar foco primero; TypeScript y global con fuente congelada solo al cerrar cambios compartidos. No lanzar dos globales ni editar fuente mientras corren.

Esta auditoría no acredita que los nuevos chats estén corregidos. La tanda194 trata una familia anterior: compra con preferencia opcional «si hay/tienes/tienen … mejor» y aclaración del alcance.
