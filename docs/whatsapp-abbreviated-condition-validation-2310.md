# Tanda144 — condición abreviada y acción independiente

Base5e081a8c, staging. Se amplía la suite143 con24 recorridos abreviados y4 controles del separador. Tres cartas sintéticas, agente simulado on/off; cláusulas en ambos órdenes, solo condición y ambas condicionadas. Conserva opción pendiente, respuesta de costo no confirmado, eliminación solo independiente, elección firme posterior, una unidad/opción exactas y DTO final sin órdenes prematuras.

Baseline12 fallos/36 aprobados: «Mora si no cuesta más; aparte quita…» detectaba condición en guarda superior con pendingChoice, pero el separador no recibía ese contexto y no procesaba la acción independiente. Se propaga el mismo booleano desde current.pendingAttribute; el valor predeterminado sigue false para otros llamadores. No cambia regex de costo ni autoriza condiciones comerciales no verificadas. No hay excepciones por catálogo PPP.

Foco142/142,12,435s; TypeScript general/build OK; Node92/92. Logs /tmp/ppp-144-baseline.log, /tmp/ppp-144-final-focus.log, /tmp/ppp-144-tsc.log, /tmp/ppp-144-node.log. Global17.080/17.080,206suites,504hashes,582,89s. Inventario exacto/fuente congelada; /tmp/ppp-144-global-summary.json. Incluye tandas142–144; no sumar reintentos ni focos.

Límites: separador explícito «; aparte», dos cláusulas, texto serial, servicios/modelo simulados. No valida recargos comerciales reales, audio, mapas, conjunciones libres ni retiro parcial. Próximo paso: contraste real acotado de conversaciones nuevas según whatsapp-api-validation-next-2310.md; conservar contador compartido y registrar presupuesto antes de red. No declarar vendible por conteos.

Predeploy de solo lectura: servidor staging c82df32d, imagen a18b22c5…,0reinicios; producción ef426c93…,0reinicios. bin/ no versionado preservado. Sin cambios al servidor durante global. Evidencia /tmp/ppp-144-before-deploy.log.
