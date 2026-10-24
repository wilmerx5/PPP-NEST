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

## Revisión local de Kamppo — 14/10/2026

Se inspeccionó, sin modificar, `/home/levi/Documents/programming/Kamppo`. Kamppo ya dispone de API NestJS, módulo WhatsApp y configuración por tenant. La entidad `apps/api/src/whatsapp/entities/whatsapp-conversation.entity.ts` declara tenantId y un índice único tenantId/waPhone. Su orquestador utiliza tipos y funciones de `@kamppo/shared`; existen servicios separados para composición de respuestas, catálogo, mutaciones de carrito y checkout, además de fixtures de pizza/sushi/hamburguesas en `apps/api/src/whatsapp/evals/tenants.spec.ts`.

Esto reduce el trabajo inicial, pero no acredita aislamiento completo: en esta revisión solo se leyó código, no se ejecutaron sus suites ni se auditaron todas las consultas. La descripción inicial de este documento corresponde a la instancia PPP, no implica que Kamppo carezca de tenantId.

Migración recomendada: portar comportamientos y contratos verificables, no copiar el orquestador PPP entero. Adaptar casos de conversación a IDs y atributos de Kamppo; convertir nombres/códigos PPP usados en fixtures en productos del tenant; integrar las reglas generales con sus servicios existentes; conservar los controles de autorización de su motor. Configurar puntos, domicilios, precios/opciones y medios de pago por tenant. El programa PPP de nueve puntos y códigos2/5 no es una regla global.

La dificultad es moderada para reutilizar casos y reglas puras, y mayor para certificar el flujo integrado multitenant. Antes de estimar plazo, ejecutar suites Kamppo y mapear las diferencias entre estados/acciones/tipos y proveedores. Prueba obligatoria de migración: mismo teléfono en dos restaurantes, carritos y precios distintos, código de premio ajeno rechazado y eventos repetidos sin pedido duplicado. No se inició ni desplegó una migración Kamppo en esta tarea.

## Idea reservada: marketplace Kamppo después del MVP — 24/10/2026

**Estado: idea registrada para una fase avanzada posterior al lanzamiento del MVP. No implementar ahora ni convertirla en requisito del MVP.**

Crear un marketplace tipo Rappi que reúna a los restaurantes que utilizan Kamppo, para que los clientes puedan descubrir restaurantes y recibir recomendaciones. El usuario quiere desarrollar mejor el concepto más adelante; esta nota conserva la idea sin iniciar diseño, desarrollo ni despliegue.

Al retomar esta fase, definir el alcance de descubrimiento y recomendaciones, la participación de los restaurantes y si los pedidos se realizan dentro del marketplace. Modelo de negocio, logística, pagos y criterios de recomendación quedan por decidir; la referencia a Rappi no implica copiar todas sus funciones.

Esta iniciativa es independiente del trabajo actual de estabilización del bot y del MVP. Retomarla tras el lanzamiento, cuando el usuario decida avanzar con esa fase.
