# Lo necesario para cerrar la aceptación de PPP

Prioridad: dejar PPP operativo antes de adaptar el motor para varios restaurantes. Las pruebas automatizadas con bases desechables permiten avanzar sin acceso a producción, pero no certifican integraciones reales ni el esquema desplegado.

## Entorno que debe preparar el responsable de PPP

1. Base MariaDB de staging separada de producción, con la versión del servidor indicada y copia del esquema actual. Incluir catálogo PPP, opciones de productos, disponibilidad, stock, horarios y tarifas fieles. Usar clientes/pedidos sintéticos y excluir información personal real.
2. Usuario exclusivo de staging con permisos adecuados para la aplicación/migraciones previstas. Configurar `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE` como secretos del entorno de GitHub Actions o del despliegue. No agregar `.env` a Git ni pegar valores en el chat.
3. Acceso de red desde el runner o servidor de pruebas; identificar el backend de staging, commit desplegado y URL del webhook. Un host privado exige runner dentro de esa red o conectividad previamente autorizada.
4. Usuario administrador de prueba para comprobar catálogo, disponibilidad, atención humana, pedidos y cambios de configuración. Entregar credenciales mediante el mecanismo seguro del entorno, no mediante archivos versionados.
5. Número/canal Meta de prueba, destinatarios autorizados de pruebas y credenciales del canal (token, número receptor, verify token y App Secret). Para ejecutar conversaciones reales, identificar explícitamente los números a los que está autorizado enviar.
6. Sandbox de Mercado Pago y, si aplican, claves de rutas/geocodificación de staging. Documentar qué pagos/domicilios están habilitados en PPP y qué resultado se espera.
7. Aislar cocina, impresoras, avisos y repartidores para que los pedidos de prueba no se atiendan como pedidos reales. Mantener desactivación rápida y revisión humana.

## Pruebas pendientes que necesitan ese entorno

| Circuito | Evidencia de aceptación |
| --- | --- |
| Arranque/migraciones | Leer settings y catálogo al iniciar; actualizar el esquema desplegado sin pérdida; reiniciar y comprobar estado. |
| Pedido completo | Conversación → carrito → dirección/recojo → pago → confirmación → un pedido real en staging con cantidades, opciones, notas y total correctos. |
| Idempotencia | Reenviar Meta ID, repetir confirmar y simular timeout sin duplicar orden, stock descontado ni pago. |
| Catálogo/stock/horario | Producto agotado, desactivado, precio cambiado y local cerrado; rechazos claros y carrito coherente. |
| Domicilio | Dirección por burbujas, apartamento/referencias, cambio tras cotización, borde de cobertura, pin, ruta no encontrada y falla del proveedor. |
| Pagos | Efectivo/cambio, transferencia según reglas PPP y Mercado Pago aprobado, pendiente, rechazado, expirado y webhook repetido. |
| Recuperación | Falla de Meta después de guardar pedido, caída de DB, reinicio con mensaje en processing, revisión de failed y conciliación de efectos. |
| Operación | Takeover humano, consulta del pedido enviado, cancelación según estado, panel administrativo y auditoría. |

Usar `docs/whatsapp-beta-acceptance.md` y los casos de los ensayos como punto de partida. Para cada caso registrar PASS/FAIL, IDs sintéticos del mensaje/pedido, estado DB y evidencia del resultado. Cerrar la aceptación cuando los circuitos críticos estén comprobados en el commit que se desplegará.
