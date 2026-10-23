## VIGENTE — tanda136: interrupciones con dirección pendiente (23/10)

Base f5df65c0, staging. 36 conversaciones nuevas: tres menús sintéticos, agente simulado on/off, dirección ambigua/fuera de cobertura, salidas corregir/recoger/cancelar. Desde carrito vacío se consultan total y carrito, elimina adicional y cambia teléfono mientras falta el destino. Confirmación prematura explica el dato pendiente sin crear orden. Corrección conserva interiores nuevos; recogida descarta dirección anterior; cancelación vacía carrito. DTO válido contiene dos unidades con nota, contacto y tarifa correctos.

Sin cambios de producción. Foco 98/98, tres suites,13,077s; TypeScript general/build OK y Node92/92. Evidencia /tmp/ppp-136-final-focus.log, /tmp/ppp-136-tsc.log y /tmp/ppp-136-node.log. No repetir global por tests/documentación; última global ejecutable135:16.872/16.872,200suites. No sumar focos solapados. Cero llamadas pagadas, WhatsApp u órdenes externas.

Staging conserva ejecutable ad76d212, imagen25de57c9…, última verificación135:23/10 11:33:31 Bogotá. Sin nuevo rebuild/verificación remota; Main intacta. Límites: cotizador/modelo simulados, turnos seriales, nombre conocido y productos sin selector. No acredita mapas reales.

Pendiente detectado: resumen muestra ✅ junto a dirección aún no ubicable, aunque sí explica el problema y bloquea confirmar. Revisar esa señal; no está corregida en136. Después: consultas/cambios durante sabor pendiente y datos anticipados en mensajes con varias intenciones.

Primer foco12/12. Expansión inicial:24 fallos de fixture (pickup omite deliveryFee, no0; cancelación necesitaba mock findTodayOrdersByPhone). Aserción adicional falló18 por buscar dirección/ubicación cuando mock decía Comparte calle y número. Ahora exige ese texto o fuera de cobertura según caso. No se relajaron cantidades, notas, estado ni DTO. Suite src/whatsapp/whatsapp-unresolved-address-interruptions.spec.ts. Publicar solo tests/documentación, sin deploy.
