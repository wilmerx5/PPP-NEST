> Seguimiento 28/10: este es el diagnóstico de partida. Los18casos se promovieron a `whatsapp-shared-serving-interruptions.spec.ts` conservando expectativas y la suite ampliada pasa90/90. Ver [validación240](whatsapp-shared-serving-edit-validation-2810.md); el cierre global continúa pendiente. La ruta `.repro.ts` inferior es histórica.

# Tanda 240 — diagnóstico de consultas y edición de una unidad (28/10)

Base local de la tanda 239 en `staging`, sin commit ni despliegue. El diagnóstico original fue opt-in; sus18casos se promovieron a `src/whatsapp/whatsapp-shared-serving-interruptions.spec.ts` y se ampliaron a90. Este documento conserva el baseline.

Tres menús ficticios × agente simulado apagado/encendido × tres recorridos: 18 casos; 12 aprobados y 6 fallidos (`/tmp/ppp-240-diagnostic.json`). Preguntar precio antes de comprar no mutó el carrito y permitió comprar después. Preguntar contenido tras repartir mantuvo ambas líneas y sus notas. En los seis casos de edición de una unidad, «A la primera [plato] quítale el [acompañamiento]» dejó intacta la primera nota; la segunda tampoco debe alterarse. El oráculo comprueba ambas líneas, no solo el texto de respuesta.

Inspección inicial: `tryHandleScopedCartNote` solo admite la posición si toda la consulta es «primera»; `tryHandleCartNoteRevision` selecciona candidatas mediante coincidencia de plato, y no deriva una selección segura del ordinal más el plato. Antes de modificar runtime, comprobar rutas previas y el contrato de `parseCartNoteRevision`; exigir que ordinal y nombre coincidan, preservar nota compartida, no tocar la segunda línea y no editar si hay una selección pendiente, link de pago o ambigüedad. Incluir reverso «segunda», repetición y prueba negativa con nombre discordante, más respuesta/estado/DTO. Evitar introducir un atajo que quite un ingrediente por error o convierta una consulta en mutación.

La tanda 239 tampoco tuvo una única global completamente verde: 20.088/20.089 en dos grupos, con un timeout del webhook bajo carga; el webhook aislado pasó 7/7. Ver `docs/whatsapp-shared-serving-fix-validation-2710.md`. No atribuir la aprobación aislada a la ejecución global ni elevar el timeout para ocultar la sensibilidad temporal.

Sin API pagada, Meta, mapas ni órdenes externas. Main/producción y servidor staging no se modificaron. Cierre posterior: la corrección acotada240 quedó validada; ver `whatsapp-shared-serving-edit-validation-2810.md` y `whatsapp-batch-240-validation.json`. No extrapolarla a toda edición de recetas.
