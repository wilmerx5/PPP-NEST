# Backend aislado de staging de PPP

El responsable confirmó que existe la base de staging, pero todavía no un backend separado. Esta preparación es un candidato revisable: no despliega ni publica servicios, no envía mensajes y no ejecuta cambios sobre la base remota.

## Qué está preparado

`docker-compose.staging.yml` construye el Dockerfile del proyecto, usa una imagen distinta y un único proceso, escucha en `127.0.0.1:3301`, limita memoria y logs y consulta `/api/health`. No monta el repositorio sobre los archivos compilados. El workflow `PPP Staging Image Check` comprueba la imagen, las unitarias con Node/dependencias npm del contenedor y la configuración de Compose sin arrancar contra una base real. Si pasa, guarda `ppp-staging.tar.gz` como artefacto durante siete días, etiquetado con el SHA y sin secretos.

El perfil `PPP_STAGING=true` exige que host/base coincidan con los valores declarados en `STAGING_EXPECTED_DB_HOST` y `STAGING_EXPECTED_DB_DATABASE`, y que se use TLS con validación de certificado. Si hace falta una CA propia, configurar `DB_SSL_CA` con el PEM correspondiente; no desactivar la verificación para conseguir conectividad.

Las escrituras de Meta —texto, media y subida de archivos— están bloqueadas en staging por defecto. Para habilitarlas se requieren `WHATSAPP_STAGING_OUTBOUND_ALLOW=true`, el mismo `phoneNumberId` que `STAGING_WHATSAPP_PHONE_NUMBER_ID` y una lista explícita `STAGING_WHATSAPP_RECIPIENTS` de números autorizados de prueba. Esto protege frente a credenciales o números copiados en settings de la DB. La configuración de producción mantiene su comportamiento existente cuando no se activa este perfil.

## Información que falta

- Servidor o plataforma donde ejecutar un backend separado y acceso de despliegue configurado por su responsable.
- URL HTTPS elegida, DNS/proxy y frontend/usuario administrador de pruebas.
- Canal Meta de pruebas y destinatarios autorizados; cocina, impresoras y avisos de staging aislados.
- Credenciales sandbox únicamente de los pagos/integraciones que PPP vaya a probar.

No entregar contraseñas ni llaves privadas por el chat o Git. Completar los secretos en el servidor o gestor de secretos del entorno.

## Preparación por el operador

1. Usar un directorio/check-out independiente del backend de producción y fijarlo al SHA candidato que haya pasado las pruebas. Respaldar la DB de staging antes de iniciar la aplicación y comprobar permisos sobre esa base.
2. Copiar la plantilla y editar sus valores de forma privada:

   ```bash
   cp config/staging.env.example .env.staging
   chmod 600 .env.staging
   ```

   Completar `DB_*`, ambos `STAGING_EXPECTED_DB_*`, `JWT_SECRET` exclusivo y las variables necesarias para los módulos que se vayan a usar, incluida la configuración del cliente Google OAuth si está habilitado. Mantener credenciales reales de Meta, mail y pagos fuera de este entorno; usar las correspondientes de pruebas. La plantilla no es una configuración de arranque completa hasta rellenarla.

3. Revisar settings persistidos de WhatsApp. `WHATSAPP_ENABLED=false` no anula `enabled=true` guardado en la DB; `WHATSAPP_AGENT_V1=false` sí desactiva el agente. Mantener el bot apagado mientras se configura y no reutilizar conversaciones de clientes. Las credenciales guardadas en DB tienen prioridad sobre las variables de entorno: comprobar el canal efectivo desde el administrador de staging.
4. Validar la configuración sin mostrar valores de secretos:

   ```bash
   docker compose --env-file .env.staging -p ppp-staging -f docker-compose.staging.yml config --quiet
   ```

5. Una vez revisado el destino y autorizado el despliegue de staging, descargar el artefacto de imagen del SHA aprobado, poner ese SHA en `STAGING_IMAGE_TAG` y cargar/arrancar la imagen verificada:

   ```bash
   gunzip -c ppp-staging.tar.gz | docker load
   docker compose --env-file .env.staging -p ppp-staging -f docker-compose.staging.yml up -d --no-build
   docker compose --env-file .env.staging -p ppp-staging -f docker-compose.staging.yml ps
   curl --fail http://127.0.0.1:3301/api/health
   ```

   Si no se usa el artefacto, construir desde el checkout fijado con `up -d --build` y registrar la imagen resultante; no dar por probada otra imagen distinta. `/api/health` comprueba conexión DB, no la aceptación comercial. Revisar errores de arranque y esquema. `RUN_MIGRATIONS=false` desactiva los SQL de carpeta, pero el bootstrap sigue asegurando columnas/tablas/índices críticos de varios módulos. El arranque puede modificar el esquema de staging; no es una auditoría de solo lectura. `synchronize` de TypeORM permanece desactivado.
6. Para probar desde el computador del operador sin publicar el puerto:

   ```bash
   ssh -L 3301:127.0.0.1:3301 USUARIO@SERVIDOR_STAGING
   ```

   Usar el acceso ya configurado. La URL local será `http://localhost:3301/api`; para recibir Meta después se necesita un proxy HTTPS al puerto local y callback del canal de prueba. Actualizar URLs, CORS y cookies a ese dominio HTTPS antes de probar autenticación externa; usar un dominio de cookie exclusivo de staging y un JWT secret distinto del de producción.
7. Configurar y verificar el canal sandbox, destinatarios y modelos. Activar el agente y el bot desde el administrador de staging; habilitar envíos únicamente después de comprobar que la configuración efectiva coincide con el canal de prueba. Un cambio del archivo de entorno requiere recrear el contenedor.
8. Ejecutar los circuitos de [aceptación](whatsapp-beta-acceptance.md): comparación de cada unidad/variante/nota en cocina, pagos habilitados, duplicados, reinicio, takeover y carga de hora pico. Registrar evidencia en el SHA y modelo exactos. No dirigir producción al backend de staging.

## Detención y recuperación

```bash
docker compose --env-file .env.staging -p ppp-staging -f docker-compose.staging.yml stop api
```

Volver al SHA/imagen anterior del proyecto aislado y comprobar compatibilidad de esquema antes de arrancar. Detener un contenedor no revierte migraciones ni operaciones de DB. Conciliar cualquier mensaje con efectos inciertos y no reejecutar automáticamente `processing`/`failed`. Ver los [criterios de piloto](ppp-pilot-readiness.md).
