# Tandas 241–243 — pendientes históricos (28/10/2026)

Base local '320c5785' en staging. Continúa tres familias de los chats abiertos y aplica la cadencia autorizada: pruebas focalizadas durante las tres tandas y una global al cerrar el grupo. El fetch actual falló por DNS; no se afirma sincronización remota nueva. Se preserva dist/tsconfig.tsbuildinfo previo.

## Diagnóstico de partida y resultado

Los tres archivos opt-in originales (chat-2510-audit, evening-chats-2510 y order-transfer-diagnostic) se reejecutaron sin modificar expectativas:22/28 antes,28/28 después. Las seis rojas originales eran tres formulaciones en dos modos de agente simulado: preparación de ejecutivo añadida como otra unidad, combo con bebida «7 up» separado con bebida perdida, y arranque de domicilio guardado como dirección. Las otras 22 se conservan verdes. Esta muestra contiene14 formulaciones; no es la lista de28 recorridos completos del audit de chat.txt.

## Cambios

- 241: gramática cerrada de arranque logístico con muletillas y artículo numérico1; no asigna destino ni confirma dirección. Se acota una regla previa que aceptaba cualquier cola corta de «para domicilio» y podía descartar edificios. Antes del agente se aplica el manejador existente de logística cuando toda la frase es logística afirmativa; no depende de que el proveedor la clasifique.20 controles de parser/router en tres menús, off/on, pedido posterior y conservación de dirección/carro/paso ya válidos.
- 242: un nombre completo con artículo definido y una preparación de la misma familia usa el reemplazo atómico ya existente. Mantiene cantidad, precio vigente y opciones compatibles; otra preparación ya presente o varias preparaciones previas exigen aclaración. Repetición no añade otra unidad; preguntas conservan el carrito.34 controles: tres menús en compra/pago/confirmación, compra adicional independiente, consulta, chat original y cierre/DTO con dos unidades y bebida heredada. Los sintéticos finales usan estilos reconocidos por el catálogo (frito/asado/gratinado); salteado arbitrario, referencias parciales y todos los estilos posibles NO quedan acreditados.
- 243: se admite omitir la etiqueta «combo» únicamente con título completo de componentes, una sola coincidencia disponible y una bebida explícita configurada; una preparación posterior debe ser una opción de catálogo. Las compras independientes, preguntas, negación, adicionales y bebidas no configuradas quedan fuera de este resolutor.40 controles: compra y DTO en tres menús, cantidades 1/2 y opciones numéricas, chat original, negativos y duplicidad/agotado a nivel del resolutor. Los controles puros no acreditan cómo resuelve el router cada combinación rechazada por este método.

Los primeros diagnósticos de desarrollo también expusieron límites del fixture y del contrato: una aserción negativa sobre «no quiero un domicilio» se retiró porque logistics-fluff ya lo considera no-dirección, no porque el nuevo regex lo aceptara. No se cambió esa semántica de negación en esta tanda. El primer fixture de preparación usaba «salteados», fuera del vocabulario de estilo existente; la matriz final acota el alcance a estilos reconocidos, sin declarar resuelto ese estilo. El baseline inalterado de los chats originales es la comparación antes/después válida.

## Validación del conjunto

94 pruebas nuevas. Foco359/359 en10 suites; global20.273/20.273 en312 suites en dos fases disjuntas, sin omisiones/duplicados según inventario Jest:310 suites/20.186pruebas a4workers, después 2 suites/87 pruebas de ráfagas y webhook aisladas. Sin reintentos ni aumento de timeouts. Duraciones: 577,941 s + 116,154 s. TypeScript general y de build aprobados ; 7 pruebas Node aprobadas. Snapshot antes/después de src/scripts/workflows/package/tsconfig: 623 archivos sin cambios. Evidencia durable: 'whatsapp-batch-241-243-validation.json'.

Todo usa servicios/modelos externos simulados. Agente activado en el harness no demuestra comprensión de un modelo real; las mejoras probadas son del router/catálogo. Sin Meta, mapas, inferencia pagada, órdenes externas ni despliegue. Main y modelos intactos. Estado de servidores heredado del relevo (staging231, producción235), no vuelto a consultar.

## Corpus y continuidad

El audit de chat.txt registra445mensajes y28 recorridos delimitados manualmente. Tener 28 diagnósticos verdes no significa haber ejecutado esos28 recorridos de principio a fin, y tampoco cierra todos los PDF. No existe aquí un denominador integral validado para informar un porcentaje del corpus corregido.

Siguiente: matriz por conversación con fuente anonimizada, turnos reproducidos, carrito/respuestas/estado/DTO final, límites y pendientes explícitos. Mantener los replays de desarrollo separados de una evaluación reservada con modelo real. Continuar reparto con opciones y consultas combinadas fuera del contrato acotado de239–240. No repetir la global mientras no haya cambios de fuente ni fallos que lo justifiquen.
