# Requisitos para usar el motor en Kamppo

## Estado observado

El código actual es de un solo restaurante por instancia/base. `WhatsappSettingsService.getSettings()` selecciona `id=1`; conversaciones se identifican por `wa_id` global, sin restaurante/canal. El controlador recibe metadatos del número de Meta, pero el parser no los conserva como ámbito de cada mensaje. Locks y rate limits viven en memoria del proceso.

Las pruebas del carrito y la IA, incluso acompañadas por MariaDB real, no demuestran aislamiento entre restaurantes ni seguridad del checkout completo. No habilitar varios restaurantes compartiendo esta instancia como si fuera un motor multiempresa validado.

## Criterios antes de habilitar varios restaurantes

| Área | Requisito verificable |
| --- | --- |
| Enrutamiento | Resolver restaurante por canal/número receptor autorizado y conservar el contexto en todas las operaciones. |
| Datos | Asociar configuración, catálogo, conversaciones, pedidos, pagos y repartos al restaurante. Rechazar referencias de otro restaurante. |
| Conversaciones | Clave compuesta restaurante/canal/cliente: el mismo teléfono puede pedir en dos restaurantes sin compartir carrito. |
| Acceso | Probar que un administrador no puede consultar o modificar datos ajenos ni pasando IDs válidos. |
| Concurrencia | Coordinación entre procesos, idempotencia de pedidos y pagos, límites por restaurante/canal/cliente y recuperación tras reinicio. |
| Checkout | Pedido completo persistido, total recalculado desde catálogo, cierre del local, stock, cancelación, pago sandbox, reparto y errores de proveedores. |
| Migraciones | Probar una base nueva y actualizaciones desde el esquema desplegado con respaldo y plan de recuperación. |
| Operación | Auditoría por restaurante, alertas, revisión de mensajes fallidos y métricas sin exponer credenciales o datos personales. |

Antes de cambiar claves y migrar datos, decidir explícitamente entre una base/instancia por restaurante o un esquema compartido con aislamiento por tenant. Una instancia por restaurante reduce el cambio de modelo inicial, pero requiere validar también enrutamiento, secretos, despliegues y operación independientes. Ambas opciones deben pasar pruebas cruzadas entre dos restaurantes y pruebas simultáneas.
