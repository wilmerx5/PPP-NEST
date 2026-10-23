## VIGENTE — tanda 127: tres unidades con notas elípticas (23/10)

Base c276bb01, staging. Se reproducen 18 fallos en «tres platos, uno sin…, otro sin… y el último sin…»: la expansión del resto implícito consumía el primer grupo y perdía la distribución. Se reconoce primero la distribución completa de tres unidades, con propietario único disponible obtenido del catálogo. Reconoce masculino/femenino, tres/3 y último/ultima; conserva cada nota en una unidad. Sin nombres, IDs ni precios especiales de producción.

36 conversaciones nuevas (tres menús sintéticos: pasta, bowl, pescado; agente simulado on/off; dos formas elípticas × compra/coste/edición de segunda línea). Comprueban respuesta, cantidades, notas sin contaminación entre líneas, consulta sin mutación, cierre y DTO de tres unidades sin orden antes de confirmar. Suite de familia final 66/66; foco previo 107/107 (antes de añadir femenino), TypeScript general/build OK y Node 92/92. Global final 16.650/16.650, 195 suites, inventario exacto y 493 hashes intactos, 613,74 s. Cero API pagada, WhatsApp u órdenes externas.

Solo publicación en staging: despliegue agrupado pendiente. Servidor conserva la tanda 126: 0a0e5365, imagen a1651634…; última verificación 23/10 08:58:25 Bogotá, no una nueva verificación en esta tanda. Main/producción intactos. Mantener publicChat=true y orderEvents=false. No atribuir resultados a modelo o audio real ni declarar vendible por conteos.

Límites: tres grupos completos con notas acotadas y separadores explícitos; no acredita cualquier paráfrasis, reparto incompleto, cantidad contradictoria, ni instrucciones adicionales después del tercer grupo. Siguiente: correcciones parciales de grupos ya divididos («de esos tres, deja dos como estaban»), referencias ambiguas y consultas intercaladas; preservar total, notas y opciones, pedir aclaración cuando el grupo no sea único. Evidencia: [tanda 127](whatsapp-elliptical-three-notes-validation-2310.md).

### Evidencia local

- Baseline: /tmp/ppp-127-baseline.log — 18 fallos nuevos, 30 controles aprobados.
- Foco inicial: /tmp/ppp-127-focus.log — 107 aprobadas en tres suites.
- Familia final: /tmp/ppp-127-final-focus.log — 66 aprobadas (36 nuevas, 30 anteriores).
- Scripts: /tmp/ppp-127-node.log — 92 aprobadas.
- Global: /tmp/ppp-127-global-summary.json, /tmp/ppp-127-burst.json, /tmp/ppp-127-rest.json y logs correspondientes.
- Fuente congelada: /tmp/ppp-127-hashes.json. La global incluye toda la fuente final; no sumar ejecuciones focales solapadas al total global.

La modificación está en whatsapp-distributed-variants.ts; las regresiones amplían whatsapp-three-note-groups.spec.ts. El reconocimiento exige propietario único disponible y no expande cláusulas que contienen coordinación o una nueva intención dentro de la nota. Los casos positivos de esta tanda usan exclusiones distintas. No se verificó transcripción/visión ni servicios externos.
