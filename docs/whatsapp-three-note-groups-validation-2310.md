# Tanda 126 — tres grupos con notas propias

## VIGENTE — tanda 126: tres líneas del mismo plato con notas distintas (23/10)

Base 4e25463f, staging. El usuario pidió confirmar generalidad y continuar. Se detectó un fallo transversal: tres repeticiones explícitas y contadas del mismo SKU, cada una con nota distinta, se reducían a una por deduplicación por ID. Se permite conservar repeticiones con nota propia distinta cuando el segmento original trae cantidad explícita. No hay excepciones por producto/restaurante. Segundo fallo: «a la segunda ponle como nota sin ajo» no editaba la línea. El editor existente ahora resuelve ordinales del carrito y conserva las otras líneas; ante selección pendiente o posición inexistente pide aclarar sin modificar.

30 regresiones nuevas: tres menús sintéticos (pasta, bowl, pescado), agente simulado on/off; compra de tres líneas, consulta de total, edición de segunda línea y DTO de tres unidades. Doce controles de posición inexistente/selección pendiente conservan carrito. Baseline 18 fallos; tras corregir deduplicación quedaron seis de ordinal; final foco 89/89 en tres suites, TypeScript general/build OK, Node 92/92. No hay llamadas pagadas, WhatsApp ni órdenes externas. Global final 16.614/16.614, 195 suites, inventario exacto y 493 hashes intactos. El runner registró 30.128,87 s de reloj; no usar esa cifra como latencia del bot ni como benchmark de CPU (no se auditó suspensión/cambio de reloj).

Límites: cantidades y nombres explícitos en cada segmento, notas de exclusión distintas; no acredita todavía elipsis de tres grupos («uno…, otro…, el último…»), reparto libre con notas parafraseadas ni cambios de stock. No atribuir a modelos reales los resultados de mocks. Siguiente: esas formas elípticas y correcciones de grupos pendientes, con conservación del total y consulta intermedia. Main/producción y configuración pública/aislamiento de staging se preservan. No declarar vendible por conteos.

Publicación/despliegue pendiente de verificar. Detalle: [tanda 126](whatsapp-three-note-groups-validation-2310.md).

Evidencia: /tmp/ppp-126-baseline.log (18 fallos); /tmp/ppp-126-focus2.log (seis fallos de ordinal); /tmp/ppp-126-final-focus.log (89 aprobadas); /tmp/ppp-126-tsc.log; /tmp/ppp-126-node.log (92); /tmp/ppp-126-global-summary.json y burst/rest. Tests nuevos: whatsapp-three-note-groups.spec.ts.
