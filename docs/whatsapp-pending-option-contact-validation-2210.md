# Tanda 115 — datos de contacto mientras se elige bebida

## VIGENTE — tanda 115: nombre durante una opción pendiente (22/10)

Base ff8c7f81, rama staging. 18 regresiones nuevas en tres menús sintéticos (arroz, hamburguesa y salchipapa), agente simulado on/off: nombre, teléfono o dirección mientras se elige bebida de un combo de reemplazo. Comprueban respuesta con elección pendiente, carrito y selección conservados, atributos compatibles, datos guardados y 18 recorridos hasta DTO simulado sin crear orden antes de confirmar.

Se reproducía pérdida del nombre explícito: 6 fallidos / 228 aprobados. Se guarda el nombre etiquetado durante pendingAttribute y se recuerda que el dato ya se recibió cuando existe checkout pendiente. La primera global detectó una regresión en la reanudación del nombre; se corrigió y la global final pasó completa. Foco final 576/576 en cinco suites; TypeScript general/build OK; Node 92/92. Global final 16.167/16.167, 192 suites, 490 hashes intactos, inventario exacto, 522,28 s. Cero API pagada, WhatsApp u órdenes externas.

Límite: nombre explícito como mensaje separado, sin cola multiorden. No acredita interpretación de mensajes mixtos con elección+bebida+contactos ni precisión de modelos reales. Código publicado en staging, pendiente de despliegue agrupado; servidor staging sigue en a254850e (tanda 114), Main/producción preservados. Evidencia: [tanda 115](whatsapp-pending-option-contact-validation-2210.md).

Siguiente: elección textual + bebida + nombre/teléfono/dirección en un mensaje; datos antes/después de la elección; cambios de nombre y alternativas mientras se elige, con varios menús. Validar respuesta, carrito, estado y DTO sin confundir el número de opción con cantidad/teléfono.

## Evidencia y límites

- Fuente base ff8c7f81. Solo orquestador y regresiones; sin cambios de catálogo, precios, modelos o persistencia.
- Primera ejecución no compiló por una comprobación TypeScript del test (pending posiblemente undefined); se corrigió el test antes de medir el comportamiento.
- Baseline funcional: `/tmp/ppp-115-focus.json`, 228 aprobados y seis fallos de nombre. Teléfono/dirección ya funcionaban.
- Primera corrección solo contempló building_cart; la elección usa awaiting_attribute. Se amplió a ambos estados y pasaron los 18 casos nuevos.
- Primera global: `/tmp/ppp-115-rest.json`, regresión en whatsapp-pending-drink-interruptions.spec.ts: el nombre se guardaba, pero faltaba pendingCheckoutDetailsCaptured al reanudar. No se ocultó ni reintentó sin cambios; se corrigió esa señal.
- Foco final: `/tmp/ppp-115-final-targets.json`, 576 pruebas / cinco suites; incluye las 132 pruebas existentes de interrupciones de bebida.
- TypeScript final: `/tmp/ppp-115-final-tsc.log`, `/tmp/ppp-115-final-build.log`; Node `/tmp/ppp-115-node.log`, 92 aprobados.
- Global final: `/tmp/ppp-115-final-global-summary.json`; ráfagas en proceso aislado y resto con cuatro workers, sin ediciones ni validaciones simultáneas. 16.167 pruebas, 192 suites, 490 hashes iguales, 522,28 segundos. Esta segunda global sigue una corrección real.
- Modelos, transporte, geocodificación y creación de orden simulados. Los mocks verifican enrutamiento/persistencia local; no equivalen a pruebas de voz, visión, Maps o WhatsApp reales.
- Se conserva la opción pendiente y la cantidad del carrito original. Al terminar la bebida queda un solo combo con la opción compatible anterior. Los datos introducidos llegan al DTO; no se confirma ninguna orden hasta «confirmar».
- Despliegue aplazado para agrupar; no atribuir el cambio al servidor activo hasta verificar nueva imagen y health. No es una declaración de preparación comercial.
