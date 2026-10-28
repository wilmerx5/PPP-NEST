# Tandas262–263: arranque del combo y recibo de WhatsApp

Base `9a8dfe94aa864028ff0e564949b94ba04b2c25c3`, staging. Secuencia alimentaria de CHAT2510-08: petición de plato frito / «en combo», «gaseosa pepsi», consulta de composición, sustitución de papa por yuca, dos ajíes y segunda corrección. Tres cartas sintéticas (Pollo/Pescado/Tofu), agente simulado off/on, dos modalidades de arranque: ráfaga por handleIncoming con reloj simulado y turnos procesados por separado. No reproduce exactamente los tiempos de Meta del chat original.

Diagnóstico: la ráfaga ya crea el combo. Los turnos separados correctamente conservan el plato original mientras se elige la bebida del combo; la primera expectativa exigía cambiarlo antes de esa elección y se corrigió. Baseline con esa expectativa ajustada:12/12 fallaron, seis por ignorar «gaseosa Pepsi» cuando el combo ya estaba agregado y seis por omitir notas en el recibo final. No se cambió la lógica de conversión a combo ni su selección pendiente.

262 extiende la resolución existente de bebida incluida a un seguimiento corto con etiqueta bebida/gaseosa/refresco. Exige un solo dueño y una unidad; cantidades/dueños ambiguos aclaran, elecciones pendientes conservan su ruta, adicionales explícitos siguen como compras separadas. Todo se resuelve con opciones de la carta; no hay nombres/IDs/precios de PPP en producción.

263 muestra la nota de cada línea en el recibo textual de WhatsApp y las notas generales bajo «Notas del pedido». Respeta consolidación, notas distintas, totales y mensajes sin notas. No cambia el DTO ni la persistencia ni genera PDF.

Foco final207/207 en4suites;37 casos nuevos:12 recorridos hasta DTO/recibo,5 contratos del formato final,16 controles de bebida/pago/selección/adicional y4 nombres exactos con preposiciones. Dos controles iniciales pedían «igual/incluida» durante una selección de cocina activa; se corrigieron para exigir la pregunta de esa selección y conservación íntegra del estado, sin modificar runtime por ese caso.

Límites: transporte/modelo/órdenes simulados; ráfaga con reloj controlado, no Meta real ni prueba de carreras en producción. El recorrido usa tres cartas sintéticas y checkout recogida/contacto sintético; no acredita domicilio/contacto del chat histórico, PDF ni canal real. Continúan episodio28/referencias abreviadas y otros compuestos, muestra reservada/modelos/medios/canal y piloto supervisado. Cero inferencia pagada; ledger267/256/11 y modelos intactos. Sin esquema/persistencia nueva; producción244 sin cambios. Global/TypeScript en `whatsapp-batch-262-263-validation.json` al aprobarse.

Primera global detenida: dos regresiones en correcciones existentes «la bebida que sea …». El nuevo seguimiento corto interceptaba esa gramática; se devolvieron conectores de corrección a la ruta anterior. Las expectativas históricas permanecen iguales; la aprobación requiere repetir todo el inventario sobre la fuente final.

Segunda global: comprensión general aprobada, pero regresión en checkout por «la bebida del … con …». Se detuvo el bloque restante y se excluye esa ejecución de aprobación. El guard final distingue conectores de corrección frente a valores exactos de catálogo. Checkout completo42/42 y los dos casos históricos de «que sea» aprobados sin cambiar expectativas. Se vuelve a recorrer todo el inventario sobre la nueva fuente congelada.

## Cierre

Global20.940/328suites, inventario exacto,539fuentes src sin cambios; TypeScript general/build y Node92/92 aprobados.

Código `9036bfe3` publicado y desplegado solo en staging: healthy,0reinicios, APIlocal/pública200, DBconnected/circuitCLOSED; doce controles compilados nuevos/previos y guard central aprobados, servicios externos aislados. Env/compose/modelos intactos y producción244 sin cambios. Evidencia `whatsapp-batch-262-263-staging-deployment.json`; commit posterior documental, sin reconstrucción.
