# Tanda 124 — lista de productos y notas

## VIGENTE — tanda 124: confirmación de varios productos con notas propias (22/10)

Solicitud explícita: mostrar los productos añadidos en lista y la nota debajo de su producto, en vez de nombres separados por comas y notas al final. Base a52a6ec8, staging. buildCartAddReply presenta varias adiciones numeradas; opciones y nota quedan bajo cada producto. Una adición conserva el formato breve previo. Las notas se buscan entre las últimas líneas de ese producto, distinguiendo apariciones repetidas, sin tomar notas de líneas antiguas. No cambia carrito, cantidades, precios ni asignación de notas.

Siete pruebas nuevas: seis recorridos router (tres menús, agente simulado on/off) comprueban compra, nota en su plato y posición de respuesta; una de formato contrasta dos variantes del mismo producto con notas diferentes y una línea antigua. Baseline siete fallos de formato; final siete aprobados. Dos suites relacionadas aportan 636 aprobadas (combos y notas/opciones). Un run intermedio falló por spy de ordersService.create ausente en el nuevo test; se corrigió el fixture y se repitió la suite afectada. TypeScript general/build OK. No nueva global por cambio exclusivamente de presentación; última global de reglas: tanda 121, 16.459 aprobadas. Cero API pagada, WhatsApp u órdenes externas.

Pendiente publicar/desplegar exclusivamente staging. Main/producción preservados. Siguiente: retomar correcciones libres de grupos pendientes y conversación básica de cierre. La repetición semántica dentro de una nota (ej. «sin arroz más yuca, más yuca») no se normaliza en este cambio; se conserva el texto de cocina almacenado.

Evidencia: `/tmp/ppp-124-baseline.log`, `/tmp/ppp-124-targets.json` (636 relacionadas aprobadas; seis errores de spy del fixture), `/tmp/ppp-124-layout-final.log` (7/7 finales), `/tmp/ppp-124-tsc.log`, `/tmp/ppp-124-build.log`. Producción se modifica solo en buildCartAddReply. El carrito no se muta y existe aserción de igualdad antes/después del formato. Pruebas en whatsapp-add-reply-layout.spec.ts. Mantener staging público y eventos externos bloqueados.
