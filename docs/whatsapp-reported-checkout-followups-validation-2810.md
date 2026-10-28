# Tanda268 — ráfagas de checkout y seguimiento de pedidos (28/10/2026)

Base: `87e474321540ac431bf4f927eb1f0e1b81f34e27`, rama staging. Fuente: dos chats reales aportados por el usuario; se conservan frases relevantes sin teléfonos, domicilio ni identificación de la orden real.

## Problemas y alcance

- Una burbuja de espera («Voy» / «Ya voy») después del nombre no debe convertirse en apellido. Solo se elimina la burbuja separada al final, durante captura del nombre; los nombres de varias palabras siguen admitidos.
- «Me indicas el Nequi» y variantes deben responder los datos configurados, preservar carrito/estado y retomar la dirección pendiente. Consultar no elige transferencia. El detector compartido también separa nombre + pregunta de pago en una ráfaga, sin reinterpretar otros pendientes.
- «Solo eso porfa» + un rótulo ambiguo en un domicilio sin nombre pide distinguir destinatario de barrio/conjunto. No adjudica silenciosamente el rótulo a un campo ni inventa ubicación.
- Tras confirmar, «me envías con salsas» recibe una respuesta explícita: solicitud aún no aplicada y contacto del restaurante para confirmarla. Esta tanda no implementa modificación automática de órdenes ni envío de solicitudes a cocina.
- «Me avisas cuando llegue» recibe una aclaración sobre el aviso, sin prometer notificación automática.
- El seguimiento coloquial conserva la orden registrada; se normaliza la errata «cuánto sr demora» en ese contexto. Los rangos numéricos de tiempo configurados se muestran con minutos.
- Las reacciones reales (`raw.type=reaction`, tipo normalizado `other`) se registran y no reciben respuesta. Los otros medios no soportados conservan su aviso.

No se añaden excepciones de catálogo PPP, modelos, persistencia ni migraciones SQL.

## Evidencia

Baseline corregido: 18 fallos / 2 controles aprobados. El primer intento tenía un mock de reapertura incompleto y una comparación de espacios de un nombre multilínea demasiado estricta; esos resultados no se cuentan como evidencia adicional de defectos productivos. Luego se reprodujo además el rótulo tras cierre (2 fallos) y se extendió cobertura al flujo de nombre/pago hasta DTO y a la errata de demora.

78 regresiones nuevas, tres nombres de plato (dos cartas sintéticas y arroz con pollo) × agente simulado desactivado/activado. Se comprueban respuestas, carrito, estado y el DTO final del flujo de nombre/pago. Son dependencias externas simuladas, no evaluación de inferencia real ni replay con tiempos exactos de Meta.

Foco final: 258 pruebas / 4 suites aprobadas. Un foco intermedio incluyó la suite general05 (aprobada), pero también cargó las dos pruebas nuevas del rótulo antes de la corrección; no se cuenta como aprobación final.

Global aprobada: 21236 pruebas / 332 suites, inventario exacto, TypeScript general/build y Node aprobados. Código `f9f7701d` publicado y desplegado en staging: healthy,0reinicios, APIlocal/pública200, DBconnected/circuitCLOSED. Siete controles compilados nuevos y18previos aprobados con servicios aislados; routing/modelos y guard central aprobados. Env/compose preservados y producción265 verificada sin cambios. Evidencia `whatsapp-batch-268-staging-deployment.json`; cierre documental posterior sin reconstrucción. Fuentes congeladas durante la global. Cero llamadas pagadas, Meta y órdenes externas; ledger267/256/11 intacto. Producción continúa265; delta268 para futura migración a Kamppo.

## Límites

No acredita que todos los motivos de abandono estén resueltos ni que el nombre real del cliente haya sido verificado. El rótulo ambiguo requiere respuesta del cliente. La petición posterior de salsas requiere confirmación humana, no se declara aplicada. No se cambia la expiración de borradores, la política de pago/comprobantes ni las notificaciones automáticas. No se reevalúan audio/PDF ni la inferencia inicial de dos ejecutivos («limo da») pendiente de las tandas anteriores.
