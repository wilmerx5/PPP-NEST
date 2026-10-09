# PPP WhatsApp — ensayos aislados con OpenAI real

El comando prueba `WhatsappAgentService.runTurn` con una copia del menú suministrado. La suite `hard` aplica las acciones mediante **ActionGuard y el método real `WhatsappOrchestratorService.applyActions`**, sin construir el servidor, repositorios de BD, transportes Meta ni servicios de pedidos/pagos. Configuración de ensayo: negocio abierto, límites y domicilio sin configurar. No usar estos precios/datos como fuente de producción.

## Ejecutar

La clave se toma de una variable privada o del secret de GitHub Actions. No copiarla al código, chat ni informes. El script exige `WHATSAPP_BETA_LIVE=1` y `OPENAI_API_KEY` antes de llamar a OpenAI.

```bash
# 30 conversaciones difíciles originales
WHATSAPP_BETA_LIVE=1 WHATSAPP_BETA_SUITE=hard WHATSAPP_BETA_CASE_LIMIT=30 yarn beta:whatsapp:ai

# 28 conversaciones nuevas, repetidas dos veces: cantidades, notas, variantes y correcciones
WHATSAPP_BETA_LIVE=1 WHATSAPP_BETA_SUITE=hard WHATSAPP_BETA_CASE_OFFSET=30 WHATSAPP_BETA_CASE_LIMIT=28 WHATSAPP_BETA_REPEATS=2 yarn beta:whatsapp:ai
```

Modelo predeterminado: `gpt-4o-mini`; `WHATSAPP_BETA_MODEL` permite especificar otro. Dos repeticiones ayudan a detectar variación; no garantizan robustez general.

## Comprobaciones

- IDs y cantidades finales; exclusión de productos ajenos; no duplicar artículos al recibir notas/dirección.
- Valores de atributos del catálogo, elección explícita y primera opción para los omitidos.
- Notas por plato y variantes del mismo SKU en líneas independientes.
- Ausencia de acciones prohibidas, intención de la respuesta y límite de longitud.
- Copias independientes del carrito en cada turno, evitando alterar retrospectivamente el historial del informe.
- Una suite vacía o un caso rechazado devuelve código de error. Actions verifica todos los grupos informativos y difíciles, incluidas las repeticiones.

Informes sintéticos: `tmp/whatsapp-beta-ai-report.json`, artefactos separados por grupo y detalles de los rechazos en los logs. No subir al repositorio informes con chats reales, datos personales o credenciales.

## Límites del ensayo

La suite `hard` cubre interpretación, sanitización y aplicación real de acciones al carrito **en memoria**. No ejecuta `handleIncoming`, el enrutamiento completo, persistencia, concurrencia distribuida, inventario, cobertura/tarifa real, cocina, pagos ni creación/confirmación de órdenes. Los seis casos básicos y los 33 informativos siguen aislados en AgentV1. Validar el recorrido completo en staging con BD y transportes aislados antes de desplegar.

Las siete pruebas en `whatsapp-cart-integration.spec.ts` verifican además la aplicación real de correcciones, opciones y notas sin OpenAI. `yarn test:whatsapp` incluye estas pruebas y las de lenguaje con el catálogo suministrado.
