# Tanda295 — consultas de producto con ocasión de consumo

## VIGENTE — tanda295: producto frente a ocasión de consumo (29/10)

Base `0bb16f76`. Reporte Kamppo «hamburguers for lunch»; usuario aplazó expresamente idiomas. Se reproduce solo la familia española: «tienen hamburguesas para almorzar», cena/desayuno, saludo/veci/porfa y verbo «tines». Consulta explícita acotada separa producto y ocasión; respeta calificadores, título literal de catálogo, selección pendiente y estados de checkout. Presentaciones por palabras del catálogo, no IDs de PPP. Una sola mini hamburguesa también es oferta válida; agotados no se listan y ausencia real no se cambia por ejecutivos. Sin compra implícita ni promesa de horario futuro.

87 pruebas nuevas:60 recorridos con tres familias, carrito vacío/existente y agente simulado off/on;16 controles de presentación única, agotado, inexistente y todas agotadas;11 límites/calificadores. Baseline36:8 aprobados/28 fallidos. Foco304/5; global26514/362, inventario exacto y575 fuentes congeladas. TypeScript general/build y Node aprobados. Global no-timers con timeout20s como CI; timers seriales. Evidencia `whatsapp-batch-295-validation.json` y `whatsapp-batch-295-patterns.md`.

Cero inferencia/Meta/órdenes externas, ledger267/256/11 intacto. Sin SQL/modelos nuevos. Revisión de patrones seleccionados ya versionados y chats del hilo, no recenso de todos los chats originales ni nueva revisión de audio/PDF. Prioridad siguiente: referencias/cambios, cierre informal, datos fragmentados y postventa. Producción292 y Kamppo282; deploy staging se registra aparte. Mezcla de idiomas aplazada.

## Familias recurrentes observadas: prioridad cualitativa, no ranking estadístico

Se revisaron los14 patrones seleccionados de `scripts/fixtures/whatsapp-real-chat-patterns.json` (su metadato cita34 bloques de origen), los26 patrones de desarrollo de `whatsapp-pdf-1110-patterns.json`, las cuatro entradas de `whatsapp-real-chat-followups-2810.json` y los ejemplos aportados en este hilo. Son selecciones y registros históricos; no un corpus completo de fallos con versión/modelo y denominador común. No se puede calcular de aquí una tasa de error ni afirmar cuál categoría es numéricamente la más frecuente.

- **Intención y referencia del cambio.** «Cambia el de pechuga a broaster» convertido en pollo entero; bebida incluida cobrada aparte; salsas/notas en el producto incorrecto. Corpus: cambio-acompanamiento, pregunta-durante-variante, included-components, drink-target; episodios CHAT2510-08 y CHAT2510-05. Priorizar SKU padre, unidades y dueño de cada opción, sin aplicación parcial.
- **Continuidad y cierre.** «No maa», «sí/yes» y preguntas por el total no avanzan o caen en otro paso. Corpus: consulta-total, cart-total, agradecimiento-no-duplica; ejemplos del hilo. Verificar siguiente estado, respuesta y orden única, no solo carrito.
- **Datos por partes y reparaciones.** «Natalia» / «voy», barrio tomado por nombre, pregunta capturada como dirección y nomenclatura dictada truncada. Corpus: preparacion-y-barrio, direccion-por-partes, fragmented-address, sequential-address-burst. Riesgo operativo alto aunque no se dispone de frecuencia.
- **Catálogo expresado de manera natural.** «Algo de tomar», «pollito en combo», «booster», carne que devuelve postres y ocasión confundida con plato. Corpus: bebida-typo, availability, spoken-courtesy, flavor-fallback. Esta tanda cubre un subconjunto español y reproduce el fallo sin invocar un modelo; no atribuye la causa al cambio de modelo.
- **Después de registrar.** Salsas, dirección y seguimiento respondidos como estado genérico o nueva compra. Corpus: postventa-cancelacion, postorder-status. Exige distinguir edición realmente aplicada, consulta y derivación humana.

Abandono no equivale a fallo del bot: solo se atribuye cuando hay una respuesta o transición incorrecta demostrable. Los casos sin respuesta posterior y con siguiente paso claro quedan como causa desconocida. La ampliación sigue usando oráculos de catálogo/estado, controles negativos y variantes sintéticas; no aprendizaje automático de chats en producción.
