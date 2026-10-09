# Backend aislado de staging de PPP

El entorno elegido es `/opt/ppp-staging` en el VPS autorizado, con dominio `dev.prontopolloportal.com` y una DB externa de staging. Los archivos están preparados; el operador debe completar el entorno privado y ejecutar el despliegue. El backend de producción y los demás proyectos Docker usan sus propios contenedores y puertos.

## Qué está preparado

`docker-compose.staging.yml` construye el Dockerfile del proyecto, usa una imagen distinta y un único proceso, escucha en `127.0.0.1:3301`, limita el runtime a una CPU y 1 GiB de memoria, rota logs y consulta `/api/health`. Los límites del contenedor no limitan el trabajo de construcción de la imagen. No monta el repositorio sobre los archivos compilados ni crea MariaDB. Usar siempre este archivo: el `docker-compose.yml` general del repositorio define una DB local.

El workflow `PPP Staging Image Check` comprueba la configuración Nginx, la imagen, las unitarias con Node/dependencias npm del contenedor, Compose y el arranque/recuperación contra MariaDB desechable con TLS. El runtime de prueba nunca accede a la DB remota ni usa credenciales API: su red no tiene salida al exterior. Si pasa, guarda `ppp-staging.tar.gz` como artefacto durante siete días, etiquetado con el SHA y sin secretos.

El perfil `PPP_STAGING=true` exige que host/base coincidan con los valores declarados en `STAGING_EXPECTED_DB_HOST` y `STAGING_EXPECTED_DB_DATABASE`, y que se use TLS con validación de certificado. Si hace falta una CA propia, configurar `DB_SSL_CA` con el PEM correspondiente; no desactivar la verificación para conseguir conectividad.

Las escrituras de Meta —texto, media y subida de archivos— están bloqueadas en staging por defecto. Para habilitarlas se requieren `WHATSAPP_STAGING_OUTBOUND_ALLOW=true`, el mismo `phoneNumberId` que `STAGING_WHATSAPP_PHONE_NUMBER_ID` y una lista explícita `STAGING_WHATSAPP_RECIPIENTS` de números autorizados de prueba. Esto protege frente a credenciales o números copiados en settings de la DB. La configuración de producción mantiene su comportamiento existente cuando no se activa este perfil.

## Imagen candidata comprobada

El candidato `0164a7fd5de9b6b0ff2b38b0925d36853c1cebde` pasó [construcción, Compose, 713 unitarias y runtime aislado](https://github.com/wilmerx5/PPP-NEST/actions/runs/37953620346). El [artefacto verificado](https://github.com/wilmerx5/PPP-NEST/actions/runs/37953620346/artifacts/11626738283) contiene `ppp-staging.tar.gz` y vence el 16 de octubre de 2026; extraer primero el ZIP descargado. Para usarlo, fijar `STAGING_IMAGE_TAG=0164a7fd5de9b6b0ff2b38b0925d36853c1cebde`. La prueba comprueba TLS confiable y rechazo de CA no confiable/destino DB incorrecto/TLS desactivado, arranque, acceso admin y firma webhook, caída de DB con HTTP 503, recuperación sin reiniciar API y reinicio del contenedor. No equivale a aprobación comercial: las pruebas con IA siguen bloqueadas por saldo, y no se ha arrancado ni desplegado este backend contra la DB remota. Ver [estado del piloto](ppp-pilot-readiness.md).

## Información que falta

- Completar los secretos privados del servidor, DNS y certificado del dominio elegido.
- Frontend y usuario administrador de pruebas; este repositorio publica la API, no el frontend.
- Canal Meta de pruebas y destinatarios autorizados; cocina, impresoras y avisos de staging aislados.
- Credenciales sandbox únicamente de los pagos/integraciones que PPP vaya a probar.

No entregar contraseñas ni llaves privadas por el chat o Git. Completar los secretos en el servidor o gestor de secretos del entorno.

## Preparación por el operador

1. En la terminal del VPS, actualizar el checkout que ya existe:

   ```bash
   cd /opt/ppp-staging
   git pull --ff-only origin fix/whatsapp-regression-baseline
   git rev-parse HEAD
   ```

   Si aún no se ha clonado, usar `git clone --branch fix/whatsapp-regression-baseline https://github.com/wilmerx5/PPP-NEST.git /opt/ppp-staging`. Respaldar la DB de staging antes de iniciar la aplicación y comprobar permisos sobre esa base. El arranque puede modificar el esquema: `RUN_MIGRATIONS=false` desactiva los SQL de carpeta, pero el bootstrap sigue asegurando columnas/tablas/índices críticos. `synchronize` de TypeORM permanece desactivado.
2. Copiar la plantilla y editar sus valores de forma privada:

   ```bash
   [ -f .env.staging ] || cp config/staging.env.example .env.staging
   chmod 600 .env.staging
   nano .env.staging
   ```

   Completar `DB_*`, ambos `STAGING_EXPECTED_DB_*`, `JWT_SECRET` exclusivo y las variables necesarias para los módulos que se vayan a usar. El backend actual siempre carga la estrategia Google: exige `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` para arrancar, además del callback de staging para probar ese login. Mantener credenciales reales de Meta, mail y pagos fuera de este entorno; usar las correspondientes de pruebas. La plantilla no es una configuración de arranque completa hasta rellenarla.

3. Revisar settings persistidos de WhatsApp. `WHATSAPP_ENABLED=false` no anula `enabled=true` guardado en la DB; `WHATSAPP_AGENT_V1=false` sí desactiva el agente. Mantener el bot apagado mientras se configura y no reutilizar conversaciones de clientes. Las credenciales guardadas en DB tienen prioridad sobre las variables de entorno: comprobar el canal efectivo desde el administrador de staging.
4. Validar la configuración sin mostrar valores de secretos:

   ```bash
   docker compose --env-file .env.staging -p ppp-staging -f docker-compose.staging.yml config --quiet
   ```

5. Construir y arrancar únicamente la API del proyecto de staging:

   ```bash
   docker compose --env-file .env.staging -p ppp-staging -f docker-compose.staging.yml up -d --build api
   docker compose --env-file .env.staging -p ppp-staging -f docker-compose.staging.yml ps
   curl --fail --show-error http://127.0.0.1:3301/api/health
   ```

   Esperar a que el contenedor esté healthy. Si falla, revisar `docker compose --env-file .env.staging -p ppp-staging -f docker-compose.staging.yml logs --tail=100 api` de forma privada, sin compartir secretos. `/api/health` comprueba conexión DB, no la aceptación comercial. El contenedor `mariadb_local` detenido del intento anterior puede aparecer como huérfano; no hace falta borrarlo ni eliminar volúmenes. Para usar el artefacto verificado en vez de construir, fijar su SHA en `STAGING_IMAGE_TAG`, ejecutar `gunzip -c ppp-staging.tar.gz | docker load` y sustituir `--build` por `--no-build`.

6. Crear un registro DNS **A** para `dev.prontopolloportal.com` que apunte a `76.13.119.125`. Si existe un registro AAAA, debe dirigir al mismo VPS mediante una IPv6 funcional. El dominio debe llegar a este Nginx por el puerto 80 antes de solicitar el certificado.

   Instalar el sitio nuevo y respaldar la configuración actual; estas comprobaciones detienen la instalación si las rutas del sitio ya existen. Revisar el sitio existente en ese caso, sin sobrescribirlo:

   ```bash
   cp -a /etc/nginx "/root/nginx-backup-$(date +%Y%m%d-%H%M%S)"
   test ! -e /etc/nginx/sites-available/ppp-dev &&
   test ! -e /etc/nginx/sites-enabled/ppp-dev &&
   test ! -L /etc/nginx/sites-enabled/ppp-dev &&
   install -m 644 config/nginx/ppp-dev.conf /etc/nginx/sites-available/ppp-dev &&
   ln -s /etc/nginx/sites-available/ppp-dev /etc/nginx/sites-enabled/ppp-dev &&
   nginx -t && systemctl reload nginx
   curl --fail --show-error http://dev.prontopolloportal.com/api/health
   ```

   Si falta Certbot o su plugin Nginx, instalarlo con `apt-get update` y `apt-get install --no-upgrade -y certbot python3-certbot-nginx`. No actualizar Docker ni reiniciar servicios existentes.

   ```bash
   certbot --nginx -d dev.prontopolloportal.com --redirect
   nginx -t && systemctl reload nginx
   curl --fail --show-error https://dev.prontopolloportal.com/api/health
   ```

   Certbot solicita el correo del responsable durante el trámite. El resultado esperado de health es HTTP 200 con DB conectada. Swagger queda en `https://dev.prontopolloportal.com/api`. La plantilla ya usa HTTPS, cookie exclusiva del host (dominio vacío) y callback Google de staging. Ajustar las URLs frontend a su entorno de prueba antes de validar login externo y registrar ese callback en el cliente OAuth de Google. No modificar otros virtual hosts ni detener Nginx para emitir el certificado.
7. Configurar y verificar el canal sandbox, destinatarios y modelo aprobado. `openaiModel` se guarda en los settings de WhatsApp de la DB; revisar su valor mediante `GET /api/admin/whatsapp/settings` con una sesión administradora de staging y fijar el snapshot aprobado mediante `PATCH /api/admin/whatsapp/settings`, por ejemplo `{"openaiModel":"gpt-4.1-2025-04-14"}` después de aprobar sus pruebas. Mantener bot y agente apagados durante esta preparación. Después activar el agente y el bot desde el administrador de staging; habilitar envíos únicamente después de comprobar que la configuración efectiva coincide con el canal de prueba. Un cambio del archivo de entorno requiere recrear el contenedor.
8. Ejecutar los circuitos de [aceptación](whatsapp-beta-acceptance.md): comparación de cada unidad/variante/nota en cocina, pagos habilitados, duplicados, reinicio, takeover y carga de hora pico. Registrar evidencia en el SHA y modelo exactos. No dirigir producción al backend de staging.

## Detención y recuperación

```bash
docker compose --env-file .env.staging -p ppp-staging -f docker-compose.staging.yml stop api
```

Volver al SHA/imagen anterior del proyecto aislado y comprobar compatibilidad de esquema antes de arrancar. Detener un contenedor no revierte migraciones ni operaciones de DB. Conciliar cualquier mensaje con efectos inciertos y no reejecutar automáticamente `processing`/`failed`. Ver los [criterios de piloto](ppp-pilot-readiness.md).
