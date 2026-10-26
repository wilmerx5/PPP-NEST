# Tanda196 — eliminar listas negativas sin añadir productos

Basee9323d41, staging, 25/10. Corrige la familia diagnosticada en195.

## Comportamiento

«No va/van A ni B» y «no quiero A ni B» se resuelven antes de la reformulación genérica de compras. Se identifican nombres completos normalizados por catálogo/carrito (incluidos espacios en volúmenes), nunca por atributos del combo. Solo después de resolver todos los objetivos se aplica una actualización. Extras ausentes no se compran; el plato principal conserva notas y cantidad, y el checkout retoma su paso.

Si un nombre es desconocido o ambiguo, no se modifica parcialmente el carrito: se solicita el nombre completo. Una selección o pago pendiente bloquea esta mutación con explicación. No cubre sustituciones mixtas, nombres abreviados, negaciones conversacionales generales ni mensajes de varios actos; no se afirma resuelto todo rechazo posible. No modifica órdenes cerradas. No hay IDs/nombres PPP en runtime.

## Validación

- Matriz195:54/54 ahora verdes, frente a46rojos/8verdes. Se promueve el diagnóstico a `whatsapp-multiple-negation.spec.ts` y se elimina su copia `.repro.ts` para no contar dos veces.
- Se añaden4controles: objetivo desconocido/ambiguo, bebida como atributo del combo y pago activo. Total58casos nuevos en inventario verde;48recorridos de negación comprueban cierre DTO simulado (antes solo2llegaban).
- Foco final82/82 con las24regresiones existentes de eliminación,12,585s (`/tmp/ppp-196-final-focus.json`). Un intento previo de ampliación no compiló por un `code` omitido del fixture; se corrigió. Logs de dos intentos de desarrollo compartieron ruta accidentalmente; no usarlos como evidencia final. El foco final usa salida única y procesos previos terminados.
- Replay focal real de194: ahora2verdes/6rojos; pasan ambas negacionesPPP, siguen7up, domicilio de cortesía y sopas. `/tmp/ppp-196-real.json`. No es replay completo de los chats.
- Repetición inmediata comprueba que no vuelve a mutar; no acredita respuesta nueva si interviene deduplicación. Modelo simulado off/on no evalúa inferencia real.
- TypeScript general/build aprobados y Node92/92.
- Global18.627/262,565hashes,685,71s, inventario exacto y fuente congelada (`/tmp/ppp-196-global-summary.json`).

## Siguiente tanda

Priorizar número en marca/opción («7 up») y selección del combo padre para evitar siete medios pollos; después cortesía que termina como dirección y reparto de sopas. Mantener las pruebas completas de corrección posterior, cantidades, DTO y respuesta. La negación con selección abierta requiere una resolución más específica futura; esta tanda evita mutar a ciegas, no acredita recuperación completa de todas las interrupciones.

Sin gasto API, Meta ni órdenes externas. Solo staging; no deploy ni Main. No declarar piloto listo por conteos.
