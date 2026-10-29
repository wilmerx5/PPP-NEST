# Tanda 289 — retiradas compuestas con cantidades

Origen: continuación del plan operativo de cantidades/cambios compuestos y de las tandas286/288. Variantes sintéticas inspiradas en referencias a opciones de los chats compartidos; no es nueva revisión de chats, PDF, audio ni investigación regional.

## Comportamiento

«Quita dos de los de pechuga y uno de los de cubos» valida cantidades y referencias de todas las cláusulas antes de guardar. Descuenta solo las cantidades indicadas; conserva precio, opciones, notas y las unidades restantes. Si vacía el carrito, vuelve a compra; si quedan platos, mantiene el paso de checkout.

Cantidad imposible, referencia desconocida/ambigua, dos cláusulas sobre la misma línea, pregunta, condición, acción mezclada, pago o selección pendiente: pedido intacto. Se solicita repetir la instrucción completa y corregida. No se guarda una lista de aclaración parcial para esta gramática; no hay aplicación parcial ni reparto inferido entre líneas.

## Cobertura gratuita

396 casos con router completo:216 retiradas,168 guardas,12 recuperaciones tras cantidad imposible. Tres familias sintéticas (pollo, tofu, pescado), agente simulado on/off, compra/revisión; tres verbos y tres pares de cantidades, eliminación completa o saldo de dos unidades. Comparan el carrito completo, estado, respuesta y ausencia de creación de orden. Carrito inicial preparado explícitamente como fixture.

Baseline:168 aprobados /228 fallidos. Foco:1.176 aprobados /3 suites, incluyendo286 y288. Global y despliegue se registran en sus JSON correspondientes después de verificar.

Límites: gramática «retira N de los/las de X y N de los/las de Y». El parser admite2–5 cláusulas; los nuevos casos ejercitan dos. No acredita operaciones heterogéneas (añadir+cambiar+retirar), aclaración por número de una operación compuesta, inventario real ni canal/modelos reales. Sin SQL, nuevos campos de sesión o cambio de modelos. Cero inferencia pagada/Meta/órdenes externas. ProducciónPPP y Kamppo no migrados en esta tanda.
