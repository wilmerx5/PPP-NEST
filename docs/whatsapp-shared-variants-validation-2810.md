# Tandas252–254: opción común y variantes existentes

Base `fff3189201caf69cdfffd62a127cb0581b4fcf9a`, staging,28/10/2026. Continúa los límites explícitos249–251: una opción común no predeterminada y un reparto cuando las dos unidades ya son filas distintas.

252 reconoce el seguimiento acotado «De <atributo> sería[n] los/las dos <opción>». Identifica dueño y opciones por catálogo, exige exactamente dos unidades del mismo producto y actualiza ambas juntas. Conserva notas, otros atributos, cantidades y pendientes; dueño ambiguo, opción desconocida, selección competidora o enlace de pago piden aclaración sin mutación. Se admite plural simple en -s solo si la opción resultante es única.

253 permite repartir filas del mismo producto solo cuando coinciden precio, notas y todos los atributos no modificados. Construye una línea tentativa agregada, valida cantidades/opciones/notas antes de guardar y sustituye todas las filas seleccionadas. Notas propias o atributos no modificados distintos mantienen la aclaración. Repetir el reparto conserva el carrito.

254 comprueba la cláusula extraída «De sopa sería los dos ajiacos» con fixture PPP cuyo valor inicial se cambia a Menudencias: dos presas diferentes, dos limonadas incluidas y un adicional separado llegan al DTO con notas y opciones. Se prueban fila inicial de cantidad dos y dos variantes ya separadas, agente simulado off/on. No es replay literal completo: se extrae una cláusula del compuesto original, se añade reparto con opciones válidas y checkout sintético.

## Evidencia y límites

Baseline12/12 rojas antes del cambio: seis en opción común sobre fila de cantidad dos y seis en reparto de filas ya separadas. Son catálogos sintéticos derivados del problema, no casos independientes de modelo. Se conserva resumen de baseline en JSON. Un desarrollo posterior falló12 expectativas de DTO por comparar con carrito ya vaciado después de crear el pedido; se corrigió el oráculo usando la instantánea previa, sin cambiar runtime por ese fallo.

64 regresiones nuevas:12 recorridos en tres menús × off/on × filas juntas/separadas,42 controles de conservación/ambigüedad,4 ramas PPP y6 pendientes de reparto. Foco final194/194 en5suites; comprueba respuesta, carrito, estado de pendiente y DTO con opciones/notas. Validación global en `whatsapp-batch-252-254-validation.json`.

No se cubren el mensaje compuesto completo con sopa y presa desconocida, repartos ambiguos iniciales entre variantes separadas, pluralización general, anáforas abiertas ni notas distintas que autoricen reasignación de dueño. Siguen pendientes replays08/28, evaluación independiente de modelos/medios/canal y piloto supervisado. No atribuir precisión real a Luna/Sol por mocks ni calcular cobertura del corpus con estos conteos.

Cero API pagada/Meta/mapas/órdenes externas. Presupuesto267/256/11 y espejo intactos; modelos y producción244 conservados. No cambia esquema ni configuración.

Código `4f825895` desplegado y verificado solo en staging: running/healthy,0reinicios, APIlocal/pública200, DBconnected/circuitCLOSED. Tres controles de comportamiento compilado y guard central aprobados con dependencias aisladas. Env/compose/modelos intactos. Imagen/backup/rollback en `whatsapp-batch-252-254-staging-deployment.json`; commit posterior solo documental. Producción244 sin cambios.
