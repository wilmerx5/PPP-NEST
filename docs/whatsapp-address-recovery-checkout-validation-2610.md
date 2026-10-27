# Tanda 228 — dirección completa, ambigüedad real y cierre

Base `fa3fb2b3`, staging. Usuario solicita corregir búsqueda de direcciones y recorrido del combo con Uva + Calle6A#79A-61; evaluar cómo acelerar compra.

## Evidencia real del proveedor

Se hicieron exactamente dos consultas de geocodificación desde el contenedor de producción, sin cambios de servidor, órdenes, mensajes ni exposición de credenciales. Consulta1: Calle6A#79A-61 con Kennedy/Bogotá/Colombia; Google devuelve Cl.6a#79A BIS-61 y Cl.6a#79B-61, ambas partial_match=false y ROOFTOP. Consulta2: Calle6A79A61 sin separadores, Bogotá/Colombia; devuelve79B-61. No se obtuvo coincidencia exacta79A-61. Este resultado actual no prueba cuál fue la respuesta histórica al chat.

Por tanto, en este caso rechazar una dirección diferente era correcto; faltaba explicar la discrepancia. Nunca equiparar BIS, letras o puerta por cercanía. Las dos consultas de Maps pueden ser facturables; no se midió su costo. Cero llamadas OpenAI/Meta, sin órdenes externas.

## Cambios generales

- Normalización de guiones Unicode, separador bajo y Nº, conservando números/letras/Bis/Sur.
- Variantes locales sin #/guion antes de búsquedas más amplias, manteniendo validación exacta. Reintentos limitados por la lista: hasta10 variantes únicas para estos destinos, salida temprana al primer resultado válido; no se acreditó SLA ni costo medio.
- Componentes route/street_number como alternativa si formatted_address no se puede interpretar. Un texto formateado contradictorio o partial_match no se rescata por componentes.
- Discrepancias de calles cercanas se explican con hasta3 direcciones alternativas válidas como candidatos del mapa, sin sustituir ni cobrar. Se pide escribir dirección completa correcta o compartir ubicación, no un sí ambiguo.
- Pedido explícito de una familia de combos con varias presentaciones pide elegir y conserva opciones por candidato, dirección y cantidad. Regla acotada a una unidad y sin otros productos: pedidos múltiples/adicionales siguen su flujo. No usa IDs o nombres de PPP como excepción.
- El total de domicilio sin tarifa resuelta se marca provisional/domicilio pendiente.

## Pruebas y diagnóstico

32 casos nuevos:25 de formato/geocodificador con límites negativos y7 de router (3menús×agente simulado off/on + control de limonada adicional). El chat estricto comprueba selección explícita, Uva/Frito, nombre, dirección conservada, mapa no resuelto, total provisional, recuperación, pago y una sola orden simulada tras confirmar.

Baseline mapa11 verdes/13 rojas. El primer fixture del chat omitía hasAttributes; se corrigió antes de acreditar conservación de Uva. La aserción inicial débil solo comprobaba lista y carrito vacío; al exigir ausencia de falsa indisponibilidad y estado pendiente falló2/2. Corrección final conserva opciones explícitas al resolver la familia.

Foco final253/253 en7 suites; revalidación de orden de consultas46/46. TypeScript general/build, Node92 y guardia Falafel verdes. Una global inicial se detuvo deliberadamente para añadir guardia de pedidos múltiples; no cuenta como resultado. Global final completa:19.760 pruebas en295 suites,602 hashes,740,58s; inventario exacto y fuente sin cambios. Evidencias `/tmp/ppp-228-*`.

## Cierre más rápido / pendientes

El código ya reutiliza el nombre válido de cuenta vinculada. Todavía no ingiere el nombre del perfil de WhatsApp. Recomendación pendiente de implementación: usar un nombre de perfil válido como destinatario editable en el resumen, sin sobrescribir un nombre explícito; si alias/emoji/negocio/ausente, pedir destinatario. No quitar identificación sin reemplazo útil para entrega. Evitar preguntar datos que ya llegaron; resolver dirección mientras se completan opciones; pedir solo el dato pendiente y mantener una confirmación final.

No se modificó caducidad: hora final del chat está truncada y no permite afirmar expiración prematura. No se declara geocodificación exacta de79A-61 ni se convierte79A en79B/BIS. Pendientes: medir con muestra de direcciones reales, comprobar reintentos/costo/latencia y diseñar captura de nombre de perfil con pruebas de identidad y destinatario distinto.

Main/modelos intactos. Publicación staging sin despliegue. Runtime210–228 pendiente de despliegue agrupado. No declarar vendible por conteos.
