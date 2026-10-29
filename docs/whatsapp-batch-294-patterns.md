# Tanda294 — preguntas de total durante selección

## VIGENTE — tanda294: total intercalado y recuperación de opciones (29/10)

Base `b4c1df2d`. «Cuánto va todo», «en cuánto va todo» y «cuánto va el pedido hasta ahora» leen el total del carrito sin acudir al modelo ni consumir la elección de sabor pendiente. Regla acotada y anclada; excluye producto específico, condiciones, adiciones, tiempo de entrega y futuras hipótesis. No suma productos pendientes de elección.

80 pruebas nuevas:72 recorridos de petición mixta rechazada por opciones faltantes, adición separada, selección por número/nombre o recuperación tras sabor inexistente y retirada explícita posterior; ocho límites de intención. Tres catálogos, agente simulado off/on, cantidades1/2 y total intercalado. Verifica que no se retire a medias ni se ejecute una operación antigua implícitamente. La aclaración atómica persistente de la mezcla sigue pendiente; estas pruebas acreditan recuperación mediante instrucciones separadas.

Baseline tras corregir fixtures:36/72 pasan y36 fallan. Foco631/5; global26427/361, inventario exacto y573 fuentes congeladas; TypeScript general/build y Node aprobados. Un timeout inicial de5s con seis workers se revalidó ejecutando toda la suite afectada en serie, sin cambiar código ni timeout; las demás suites se ejecutaron con cuatro workers. Evidencia `whatsapp-batch-294-validation.json`. Cero inferencia/Meta/órdenes externas, ledger267/256/11 intacto. Modelos preservados; sin SQL ni campos nuevos. Datos sintéticos, no nuevos chats/audio/PDF revisados. Producción292 y Kamppo282; publicación/despliegue staging se registra aparte.


El baseline inicial mezclaba el hueco real con dos expectativas del fixture: faltaba simular generateTurn, y yogur/infusión admitían la primera opción por política existente. Se sustituyeron por familias que requieren sabor explícito; no se cambió esa política.
