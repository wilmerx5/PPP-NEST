# Tanda 109 — evidencia de cierre y conservación del pedido

22/10/2026. Base a69c14f7, staging. Fuentes: conversaciones reales aportadas en el hilo (nombre confundido con dirección; combo triplicado; pin que pierde torre/apartamento), adaptadas a catálogos sintéticos y contacto de prueba. No se ejecutaron órdenes externas ni inferencia pagada.

## Cambios y pruebas

- 42 pruebas nuevas en whatsapp-checkout-full-journey.spec.ts: 7 recorridos × 3 menús × 2 modos de agente. Seis llegan al DTO de orden simulada; seis cancelan; seis aclaran líneas con opciones distintas; 24 controlan no reutilizar direcciones antiguas al recibir un nuevo pin.
- El recorrido positivo comprueba pregunta de contenido sin compra, adicional sin duplicar plato, cantidad 2→1 conservando adicional, bebida, nombre, dirección, respuesta con torre/apartamento, coordenadas usadas para cotizar, importe consultado sin compra, ausencia de creación antes de confirmar y productos/opciones/acceso en DTO.
- Se refuerzan seis casos existentes de cantidad con bebida aparte, sustituyendo límites permisivos por resultado exacto.
- El pin conserva la dirección escrita únicamente si resolvía una dirección sin coordenadas y tarifa nula, sin cambio explícito de destino ni pin con nombre/dirección propios. El pin gobierna la ruta; el texto queda como referencia. No aplica a destino fuera de cobertura.
- La disputa «solo pedí un X» corrige las líneas de X; si están divididas por opciones pregunta cuál quitar. Conserva otros productos. «Deja solo…» mantiene su ruta anterior.

## Evidencia

Baseline inicial: 6/12 fallaban por pérdida de apartamento. El primer mock empleaba un motivo genérico de fallo; se corrigió a address_ambiguous antes de la validación final. Baseline definitivo ejecutado temporalmente con el runtime HEAD anterior, restaurando luego los cambios propios: 12/42 fallidos, 30 verdes. En seis recorridos, cantidad incorrecta impide llegar al pin; los otros seis corresponden a líneas con opciones distintas y adicional.

Foco final: 650/650, 7 suites, 65,710 s. TypeScript general y build sin errores. Contratos Node 92/92. Diff limpio.

Global con fuente congelada: ráfagas 80/80 (64,990 s); resto 15.867/15.867 en 191 suites (468,111 s). Total 15.947/15.947, 192 suites, 534,21 s de orquestación. Unión de inventario exacta, sin duplicados, 490 hashes conservados. Sin reintentos.

Logs locales: /tmp/ppp-109-final-baseline.log, /tmp/ppp-109-targets.log, /tmp/ppp-109-tsc.log, /tmp/ppp-109-build.log, /tmp/ppp-109-node.log, /tmp/ppp-109-burst.json, /tmp/ppp-109-rest.json y /tmp/ppp-109-global-summary.json. Este resumen es durable; /tmp no lo es.

## Pendientes y límites

No inferir precisión del modelo, audio o mapas reales de estos mocks. Los tres menús comparten estructura de plato/adicional/bebida. No se cubrió la reproducción literal completa con respuestas reales del agente, vínculos Maps, fotos de dirección, compra y consulta combinadas iniciales ni elección numérica del combo de los chats originales. Sigue pendiente resolver referencias relativas con aclaración antes de cotizar. Main no se modificó.
