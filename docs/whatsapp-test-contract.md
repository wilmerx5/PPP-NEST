# Contrato de pruebas conversacionales

Los patrones se extraen de fuentes privadas y se sanitizan antes de versionarse. La respuesta histórica de un bot o empleado no define disponibilidad, precio ni política. El oráculo procede del catálogo, configuración y estado sembrados para cada recorrido.

Cada caso debe identificar el patrón, catálogo, carrito y selección iniciales, mensajes en orden, cambios esperados, datos que deben conservarse, contenido de respuesta y efectos externos prohibidos. Un producto correcto en el carrito no basta si la respuesta dice que no se entendió o inventa un producto/política. Consultas y entradas ambiguas deben probar conservación de estado además de aclaración.

Aplicar cada comportamiento portable a PPP y al menos un catálogo ficticio cuando dependa de nombres u opciones. Las excepciones por nombres, IDs y precios pertenecen a los fixtures, no a producción. Las pruebas de transporte usan payloads representativos de WhatsApp; las de visión y audio con respuestas simuladas no acreditan calidad del modelo real.

Separar tres niveles de evidencia:

- Regresión de desarrollo: caso ya usado para corregir. Ya no es un reservado independiente.
- Reservado: catálogo y expectativas escritas antes de ejecutarlo, sin añadir el ejemplo al prompt. Tras descubrir/corregir un fallo pasa a desarrollo.
- Inferencia real: conservar modelo, presupuesto, número de intentos y revisión de la respuesta completa. No heredar una aprobación de mocks a este nivel.

Comparaciones de staging y producción requieren comprobar código activo, modelo configurado, catálogo y contexto de conversación. Una imagen distinta, compresión distinta o selección/pago anterior cambia la comparación. No atribuir causalidad solamente porque dos respuestas difieren.

Con cambios compartidos: focalizadas, TypeScript y suite completa. Registrar baseline, errores de montaje separados de defectos de producto, resultado final y evidencia de despliegue. No contar un run interrumpido como aprobación. Mantener el presupuesto compartido y no ejecutar por defecto runners de API.

Cuarta tanda: recogida por tercero con tiempo (PDF), estados cerrados y transferencia al interpretar fotos (caso nuevo del usuario), menú sin selección, foto ilegible, recuperación OCR y comprobante explícito. Las imágenes son buffers sintéticos y la interpretación externa está simulada. El módulo de visión se verifica también con respuestas HTTP simuladas para ambos modelos configurados; no equivale a probar esos modelos con la foto original.
