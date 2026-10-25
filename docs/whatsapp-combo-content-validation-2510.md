# Tanda182: consulta de contenido del combo ya pedido

Base6da0597a. Los chats nuevos del25/10 descubren tres familias diferentes. Se cierra aquí solo la ruta de consulta del combo; no se atribuye cobertura a todos los problemas.

## Diagnóstico

«Con que viene el\nCombo\n?» entraba en disponibilidad de versiones y abría reemplazo. El usuario ya tenía combo con Pepsi; una elección posterior podía rearmarlo con valores por defecto. Se amplía la referencia de contenido existente para «el combo/plato/producto», «la opción» y «con qué viene acompañado», usando los candidatos/contexto existentes y su aclaración cuando hay varios. No se agregan productos ni se abre selector de reemplazo para estas consultas.

## Pruebas

18 recorridos, tres catálogos sintéticos de combos (pollo/pizza/ramen), agente simulado on/off y tres formas de preguntar. Carrito inicial sembrado con un combo y Pepsi: no acreditan la compra inicial por ráfagas. Verifican descripción, ausencia de selector de reemplazo, carrito intacto y posterior DTO simulado de una unidad con Pepsi. Baseline final sin corrección:15fallos/3aprobados,18,393s; /tmp/ppp-182-baseline-final.log. Foco final18/18,10,488s; /tmp/ppp-182-final-focus.log. TypeScript general/build y Node92 aprobados. Global18.331/18.331,251suites,549hashes,689,59s; inventario exacto y fuente congelada. /tmp/ppp-182-global-summary.json. Publicado solo rama staging; sin despliegue.

Los primeros seis casos intentaban construir el carrito a través del modelo simulado; ese modelo no garantiza acciones reales. Se reemplazó esa preparación por estado explícito para aislar el defecto y se repitió baseline. No confundir esto con replay completo del chat.

## Casos pendientes prioritarios

Ver whatsapp-open-cases-2510.json: incluye reproducción del pedido completo con Nequi (2/2fallos gratis) y especificaciones del reparto de ejecutivos y sustitución de acompañamientos/comprobante. El caso Nequi produce cotización en lugar de compra y convierte acompañamientos en SKU; NO corregido aquí. Las dos variantes ejecutivas deben conservar exactamente2unidades y las bebidas incluidas, con una limonada adicional separada. Colombina requiere catálogo/clarificación, no sustitución silenciosa. El comprobante no mostrar notas no prueba que falten en el DTO; comprobar ambas capas.

Cero llamadas pagadas, Meta u órdenes externas. Solo staging; Main/producción permanecen180. Próxima tanda debe priorizar pedido+consulta de total/transferencia, no seguir añadiendo solo pruebas de preguntas simples. No declarar todos los chats resueltos ni vendible por conteos.
