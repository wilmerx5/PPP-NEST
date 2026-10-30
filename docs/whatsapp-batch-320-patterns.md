## VIGENTE — tanda320: ambos/ambas en notas de dos unidades (30/10)

Base `48ffb1b3`. Reproducción nueva: «ambos sin cebolla» no aplicaba nota en dos platos distintos, mientras «las dos sin cebolla» sí. Normalización acotada de ambos/ambas/para ambos/para ambas antes de sin/poco/poca al tratamiento existente de dos unidades. Conserva controles de selección, cantidades y conflictos; con tres unidades pregunta cuáles y una pregunta no modifica carrito.

44 pruebas nuevas:32 recorridos completos en dos catálogos con agente simulado off/on (ambos, ambas, para ambos, las dos, selección, cancelación, confirmación prematura y exceso de cantidad), más12 controles con tres unidades/preguntas. Baseline4 fallidas/20 aprobadas de24; foco162/3 aprobado. Global 32541 pruebas/388 suites, inventario exacto y fuentes congeladas; TypeScript general/build y Node aprobados. Evidencias `whatsapp-batch-320-validation.json` y `whatsapp-batch-320-sources.json`.

Staging320 desplegado y verificado: código `33dd7e83`. Evidencia `whatsapp-batch-320-staging-deployment.json`. Producción292 y Kamppo282 sin promoción. Cero inferencia/Meta/órdenes externas; ledger267/256/11 intacto. Alcance: varias líneas de carrito y notas de exclusión/reducción; no se acredita una sola línea agrupada, «con salsa» genérico ni respuesta suelta «para ambos». Casos sintéticos de desarrollo, no lectura nueva de PDFs/audio ni evaluación independiente. Siguiente: preparar paridad de versiones y pruebas acotadas con modelo/canal reales; idiomas aplazados.

