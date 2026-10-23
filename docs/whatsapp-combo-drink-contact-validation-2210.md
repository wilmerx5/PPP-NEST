# Tanda 116 — elección de combo y datos en un mensaje

## VIGENTE — tanda 116: elección, bebida y contacto juntos (22/10)

Base 2aa0a9e7, staging. 48 regresiones nuevas, tres menús sintéticos y agente simulado on/off: elección textual + bebida + nombre/teléfono/dirección, datos antes/después, comas/saltos de línea, cantidad explícita. 24 recorridos hasta DTO con bebida, nota, cantidad y contacto. Otros 24 contrastan opción no ofrecida, bebida desconocida, dos sabores ambiguos y cantidad cero, sin mutar el carrito.

Baseline 24/24 fallidos en los recorridos iniciales; se reutiliza la resolución de oferta de reemplazo por combo después de capturar datos, en lugar de perder la selección o usar atributos por defecto. La separación reconoce referencias textuales a filas y cantidades; disponibilidad, precio, bebida y límites siguen a cargo de la ruta existente. Foco 624/624 en cinco suites; TS general/build OK, Node 92/92. Global final 16.215/16.215, 192 suites, inventario exacto, 490 hashes sin cambios, 531,70 s. Cero API pagada, WhatsApp u órdenes externas.

Límites: oferta de reemplazo con preferredId; cláusulas separadas por salto de línea o comas reconocidas, nombre explícito, dirección vial completa y bebida exacta del catálogo. No acredita texto libre sin separadores, reparto entre varios sabores ni modelos/Maps reales. Main/producción preservados. Despliegue agrupado 115/116 pendiente de verificación. Evidencia: [tanda 116](whatsapp-combo-drink-contact-validation-2210.md).

Siguiente: contacto y selección combinados cuando cambia precio/disponibilidad; recuperación de bebida desconocida sin perder datos; después varios sabores/unidades. Conservar contraste entre pregunta y compra y DTO hasta confirmación.

## Evidencia

- `/tmp/ppp-116-baseline.json`: los 24 recorridos fallaban antes del cambio.
- `/tmp/ppp-116-new.json`: 24 recorridos aprobados tras corregir; se amplió luego con 24 contrastes.
- `/tmp/ppp-116-targets.json`: 624/624 pruebas en cinco suites. Se añadieron después comprobaciones de bebida y nota en cada ítem del DTO, acreditadas en la global final.
- `/tmp/ppp-116-tsc.log`, `/tmp/ppp-116-build.log`, `/tmp/ppp-116-node.log`: controles aprobados, Node 92/92.
- `/tmp/ppp-116-global-summary.json`: 16.215 pruebas, 192 suites, 490 hashes idénticos, inventario exacto, 531,70 s. Ráfagas aisladas y resto con cuatro workers; fuente congelada; sin reintentos.
- Transporte/modelo/Maps/órdenes simulados. No se confirma ninguna orden externa; los 24 recorridos comprueban ausencia de creación antes de «confirmar» y el DTO final.
- Código general basado en candidatos del catálogo, sin excepciones PPP. La captura acepta datos válidos aunque la elección quede pendiente; no compra si hay fila/bebida/cantidad inválidas.
- No declarar vendible por conteos. La aceptación real de audio, imágenes, costos y comportamiento del modelo requiere la evidencia independiente indicada en el plan comercial.
