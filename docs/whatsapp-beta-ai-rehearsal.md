# PPP WhatsApp — ensayos de Agent V1 con OpenAI real (aislados)

Este comando prueba cómo `WhatsappAgentService.runTurn` interpreta mensajes reales, **sin usar el webhook Meta, la BD, ni OrdersService**. Los productos son ficticios, basados en familias del menú PPP; los precios no son fuente de verdad para producción.

## Preparación segura
1. Usar **staging o una máquina de desarrollo**, nunca el contenedor de producción.
2. Configurar una API key de proyecto de pruebas en las variables privadas del proceso. **No copiarla al repositorio, a este chat, a `.env.example`, ni a artefactos de CI.** Idealmente utilizar una key nueva con límite de gasto.
3. No reconfigurar el webhook del número de producción. No se necesita ningún teléfono para estos ensayos.
4. Comando explícito (la ausencia de flag/key detiene el script sin llamar a OpenAI):

```bash
WHATSAPP_BETA_LIVE=1 OPENAI_API_KEY="$OPENAI_API_KEY" \
  WHATSAPP_BETA_CASE_LIMIT=3 yarn beta:whatsapp:ai
```

Por defecto el script utiliza `gpt-4o-mini`. Para cambiar al **modelo real configurado** en el bot, indicar `WHATSAPP_BETA_MODEL`. Repetir los casos (p. ej. 3 veces) para detectar variabilidad.

## Salida
- `tmp/whatsapp-beta-ai-report.json`: mensajes simulados, respuestas de IA, tool calls, acciones propuestas y carrito aproximado. **Mantener local**, anonimizar antes de compartir y no subirlo a Git.
- Casos: `scripts/fixtures/whatsapp-beta-cases.json`.
- Catálogo ficticio: `scripts/fixtures/whatsapp-beta-menu.json`.

## Limitaciones
- El carrito del simulador es una **aproximación**, no `WhatsappOrchestratorService`: no ejecuta ActionGuard, validación real de atributos, persistencia, recálculo de domicilios ni confirmación real.
- Ninguna salida `addItems` ejecuta órdenes; las acciones se registran y se aplican solo al mapa en memoria.
- El informe **no decide por sí solo PASS/FAIL** sobre correcciones complejas: revisar contra la expectativa de cada caso y convertir los hallazgos en regresiones.
- Las validaciones E2E reales del orquestador deben hacerse por separado sobre **BD de staging aislada** y transportes simulados. No activar pedidos de cocina, pagos ni WhatsApp de producción.
