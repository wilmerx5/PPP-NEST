# Tanda143 — condición y acción independiente

24 nuevos recorridos (tres cartas × agente simulado on/off × cuatro variantes). Menús de sándwich, crepe y pasta, cada uno con bebida incluida y adicional vendible separado. Arrancan vacíos y terminan en orden simulada.

- «Cambia la bebida a X si no cuesta más; aparte quita el adicional»: solo retira el adicional.
- Mismas cláusulas en orden inverso: mismo resultado.
- Solo cambio condicionado: conserva adicional y selección pendiente.
- Ambas cláusulas condicionadas: ninguna mutación hasta aclarar.

En todos se comprueba explicación de costo no confirmado, pendiente idéntico, carrito exacto, selección firme posterior, estado de pago/confirmación y DTO sin productos duplicados. No se crea orden antes de confirmar.

## Resultados y límites

114/114 focalizadas en tres suites (24 nuevas, resto regresiones relacionadas),10,388s; TypeScript general/build y Node92/92. No cambió runtime: no global ni reconstrucción. Logs /tmp/ppp-143-final-focus.log, /tmp/ppp-143-tsc.log y /tmp/ppp-143-node.log. Primer intento falló12/18 porque solo inspeccionaba último mensaje; explicación estaba en mensaje previo del mismo turno. El oráculo ahora recoge h.replies desde inicio del turno, sin mezclar respuestas anteriores.

No demuestra comprensión del modelo real, mapas, audio ni costo comercial. No cubre elipsis sin verbo, conectores libres, retiro parcial o más de dos cláusulas. Revisar el contexto pendingChoice en splitCostConditionFromIndependentAction: hoy no lo recibe aunque sí lo usa la guarda superior. Esa observación es un hueco para reproducir, no un fallo ya corregido en143.

## Continuación

Reproducir elipsis condicionada con acción independiente y contrastes de alcance. Después ejecutar conversaciones reservadas con inferencia real siguiendo whatsapp-api-validation-next-2310.md, tope explícito y contabilización previa a red. No sustituir esa evidencia con más copias de las mismas frases. Agrupar despliegue142 con próxima corrección validada; preservar Main.
