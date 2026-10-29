# Tanda298 — operaciones combinadas hasta confirmación

## VIGENTE — tanda298: matriz de recuperación de operaciones mixtas (29/10)

Base `bacddb3d`.384 recorridos sintéticos:8 rechazos (destino inexistente, retirada excesiva/negativa, adición decimal/cero, referencia inexistente, condición, tercera acción) ×3 catálogos ×agente simulado off/on ×efectivo/transferencia ×retirada parcial/completa ×destino nuevo/existente. Primero exige carrito intacto y respuesta explícita; después repite la instrucción completa corregida. Comprueba retirada y adición juntas, fusión de cantidades, notas/atributos del plato restante, ausencia de notas heredadas en el producto añadido, estados de checkout, creación única solo al confirmar, unidades exactas del DTO y total/nota en recibo.

384 nuevos aprobados +456 regresiones relacionadas =840 pruebas en3 suites; TypeScript general/build aprobados. Sin fallos nuevos ni cambio de motor. Publicación de pruebas, sin despliegue nuevo. Último global de runtime26514/362 en295; no reejecutado ni atribuido al inventario ampliado298. Evidencia `whatsapp-batch-298-validation.json` y `whatsapp-batch-298-patterns.md`.

Última verificación registrada: PPP staging295, producción292, Kamppo282. Cero inferencia/Meta/órdenes externas; ledger267/256/11 intacto. Idiomas aplazados. Límite pendiente: aclaraciones cortas y persistentes de operaciones mixtas («el segundo»); esta tanda acredita recuperación repitiendo la petición completa, no soluciona ese límite.

Fuente conceptual: correcciones de pedidos del hilo y suites291/293. No se releyeron chats/PDF/audio nuevos. La matriz cruza decisiones de estado y carrito, no solo sinónimos. Cada caso prepara un carrito; no acredita extracción inicial desde texto libre ni rendimiento del modelo real. Las tandas grandes son útiles para cubrir combinaciones, pero el número de casos no mide por sí solo calidad comercial.
