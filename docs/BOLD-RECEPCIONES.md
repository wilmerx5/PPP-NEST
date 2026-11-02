# Recepciones Bold y devolución de adelantos

Implementación local del flujo solicitado el 1 de noviembre de 2026. No confirma que el QR estático de Cuenta Bold esté incluido en los webhooks del comercio: ese punto requiere prueba real. No hay generación de enlaces por pedido ni lectura de capturas como fuente de pago.

## Componentes

- API: `POST /api/bold/webhook`, firma HMAC-SHA256 de los bytes originales en Base64, clave secreta de producción no vacía y validación del ID de comercio, moneda COP, valor y fecha.
- Recepciones: `GET /api/bold/receipts`, hasta 300 ingresos recibidos en los últimos 7 días del comercio configurado. Incluye aprobados, rechazados y anulados, ordenados por hora del pago. Una notificación tardía se conserva; la interfaz muestra fecha completa, no solo hora.
- Asociar: `POST /api/bold/receipts/:uuid/claim`, cuerpo `{ "orderId": 123, "advanceAmount": 30000 }`. Requiere pedido de domicilio existente no cancelado, pago aprobado, sin uso anterior y adelanto positivo no mayor que el ingreso. `orderId` es el ID interno global, no el consecutivo diario.
- Devolver: `POST /api/bold/receipts/:uuid/return`, exclusivo de administrador. Registra una entrega física de efectivo; NO ejecuta transferencias. El adelanto es declarado por el domiciliario: caja debe verificar que recibió ese efectivo antes de devolverlo.
- Frontend: `/recepciones` en ppp-admin-front, accesible directamente sin cargar el panel administrativo. Actualiza cada 5 segundos, filtra valor exacto, referencia y datos disponibles del pagador; permite ver disponibles, propios y todos. Caja además ve pendientes de devolución.
- Nuevo rol `paymentsUser`: consultar y asociar pagos a su propia identidad. No permite devolver efectivo ni acceder a endpoints administrativos. Crear usuarios en Staff → Domiciliario: pagos. AuthPPP los dirige a `/recepciones` después del inicio de sesión. Los administradores acceden desde Pagos recibidos en el menú.

## Configuración privada del servidor

Aplicar `migrations/042_bold_receipts.sql` mediante el mecanismo existente (`RUN_MIGRATIONS=true`) antes de activar. No se usa synchronize para crear las tablas.

Configurar en el entorno privado (no en variables VITE, Git ni chat):

```dotenv
BOLD_MERCHANT_ID=<ID exacto del comercio receptor>
BOLD_WEBHOOK_SECRET=<secreto de producción de Bold>
BOLD_STATIC_QR_IMAGE_URL=https://<dominio>/ruta/qr-oficial-bold.png
BOLD_STATIC_QR_VERIFIED=false
```

La imagen debe ser el QR estático oficial descargado de la cuenta, alojado en HTTPS de confianza. No generamos un QR de enlace que aparente ser QR bancario. El panel muestra la imagen configurada; no necesita recrearla para cada pedido. No mostrar ni enviar las credenciales a los domiciliarios.

Registrar `https://<dominio-api>/api/bold/webhook` en Bold → Integraciones → Webhooks. Configurar `VITE_AUTH_ADMIN_URL` de AuthPPP con el origen de ppp-admin-front y el `VITE_API_URL` habitual de ese frontend. CORS y cookies requieren los mismos dominios autorizados que el resto del sistema.

No se aceptan firmas de sandbox con secreto vacío. Para producción no se debe usar un webhook de prueba. La firma autentica el evento, pero no demuestra por sí sola que el QR estático esté cubierto por el producto.

## Prueba obligatoria de la conexión

1. Con el QR fijo y Cuenta Bold reales, efectuar pagos pequeños controlados desde Nequi y Daviplata (sin órdenes reales de clientes).
2. Verificar en la cuenta receptora el abono y comparar con la recepción en `/recepciones`: valor, referencia, hora, método y datos disponibles del pagador. Medir demora.
3. Confirmar que los eventos provienen del QR fijo, sin crear enlaces ni cobros dinámicos. Si no llegan, consultar a Bold por cobertura de QR estático/Bre-B: no habilitar el control basándose en eventos de otro producto.
4. Confirmar habilitación y tarifas de la cuenta. No asumir nombre o banco de origen: el webhook QR documenta valor, hora, referencia y correo, pero no garantiza nombre o entidad. `seller` y `user_id` no se interpretan como identidad del pagador. El nombre de tarjeta se conserva solo si Bold lo proporciona.
5. Solo con recepción real comprobada, configurar `BOLD_STATIC_QR_VERIFIED=true` y reiniciar API. Hasta entonces la asociación está bloqueada; el feed permite diagnosticar lo recibido.

El listado solo contiene lo recibido por webhook desde su puesta en marcha; no descarga el historial anterior de la cuenta. No se hace polling masivo del fallback de Bold, ya que requiere identificador/referencia y no es un listado de abonos. La actualización cada 5 segundos consulta NUESTRA base de datos; no garantiza que Bold notifique con esa latencia.

## Controles y límites

- Evento único por ID y recibo único por payment_id; se guardan ambos dentro de la misma transacción antes de responder 200. El evento guarda huella SHA-256 para detectar un mismo ID con cuerpo distinto, sin almacenar payloads completos ni datos de tarjeta.
- Bloqueo pesimista de recibo y unicidad de pedido para impedir doble asociación y doble devolución concurrentes. La asociación y devolución guardan identidad, nombre y hora del responsable.
- La anulación es terminal y no se revierte por una aprobación tardía. Un rechazo tardío no degrada una aprobación. Las anulaciones posteriores a una devolución conservan el historial y se señalan en pantalla para revisión de caja.
- No hay desasociación ni edición destructiva. Errores de asociación necesitan procedimiento auditado futuro; no reutilizar un pago cambiando datos a mano.
- El servidor no calcula el total exigible del pedido en este módulo. El domiciliario comprueba el importe recibido; caja verifica el adelanto declarado. Un QR común de monto libre no elimina la ambigüedad de dos pagos iguales simultáneos: si faltan datos para distinguirlos, no asociar por aproximación.
- El acceso `paymentsUser` permite ver las recepciones recientes y sus asociaciones. No es un listado público ni comparte credenciales de la cuenta bancaria.

## Verificación reproducible sin servicios externos

```sh
./scripts/test-bold-isolated.sh
npx tsc --noEmit --incremental false -p tsconfig.build.json
```

El script usa MariaDB efímera en puerto aleatorio local, aplica la migración real y limpia su propio contenedor. Las credenciales son fixtures de esa base descartable, nunca credenciales de la aplicación. Prueba firma, comercio, monto, moneda, eventos duplicados, concurrencia de asociaciones/devoluciones, pedido duplicado, anulación tardía, permisos HTTP y validación de DTO. No llama a Bold ni genera cobros.

Frontend: `npm run build` en ppp-admin-front y `npx tsc -b` en AuthPPP.

Fuentes: https://developers.bold.co/webhook y https://bold.co/cf/legal/terminos-y-condiciones-bre-b .

## Estado de entrega local

- Panel compilado (`npm run build`), AuthPPP comprobado con TypeScript y API comprobada con TypeScript.
- 17 pruebas aprobadas en 6 suites de Bold, autenticación y pagos existentes, incluidas concurrencia en MariaDB aislada y permisos HTTP.
- La suite general de WhatsApp se inició y se detuvo sin completar; no se declara validación completa de esa funcionalidad ajena al cambio.
- Sin despliegue, sin migración en bases operativas y sin cobros reales. Pendientes configuración privada y verificación real de cobertura del QR estático.

## QR recibido el 2 de noviembre de 2026

El QR oficial aportado por el usuario se incorporó sin modificar a `ppp-admin-front/public/payments/qr-bold.png`. El panel lo muestra por defecto y permite reemplazarlo mediante `BOLD_STATIC_QR_IMAGE_URL`. Ya no es necesario configurar una URL para mostrar este QR. Su incorporación no acredita el destinatario ni la cobertura del webhook: ambos deben verificarse en el piloto.
