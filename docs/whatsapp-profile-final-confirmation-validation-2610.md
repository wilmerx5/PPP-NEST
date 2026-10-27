# Tanda 233 — destinatario durante confirmación final

Base `e4e231be`, rama staging, 26/10/2026. Cambio general de checkout; sin excepciones por producto o restaurante.

## Reproducción y corrección

18 conversaciones: tres menús (arroz, pizza, bowl), agente simulado apagado/encendido y tres correcciones: nombre solo, nombre+pago, nombre+consulta de domicilio. Cada recorrido parte del nombre de perfil, llega al resumen final, cambia destinatario y confirma después; verifica respuesta, carrito, dirección, pago, estado y una sola orden simulada con el destinatario correcto.

Baseline:6 verdes/12 rojas. Seis fallos reales: nombre+pago creaba la orden antes de confirmar. Otros seis eran una aserción demasiado estricta: exigía nombre en el último mensaje aunque la actualización ya se reconocía en el anterior, seguido por la respuesta de tarifa. Se corrigió el oráculo para examinar ambos mensajes, manteniendo verificación de persistencia y DTO.

El manejador de nombre/contacto exige revisar el resumen al continuar checkout. Repetir el pago junto al nombre no aprueba la compra; confirmar después sí crea exactamente una orden. No se han probado todas las negativas al perfil ni condiciones ambiguas.

Foco125/125 en cuatro suites. TypeScript general/build, Node92 y guardia Falafel1 aprobados. Global19.907/302 suites aprobada en766,09s,610hashes intactos e inventario exacto (`/tmp/ppp-233-final-global-summary.json`). Sin API pagada, Meta, órdenes externas ni cambios en Main/modelos. No desplegado.

## Respuesta a «¿ya están corregidos todos los chats?»

No hay evidencia para afirmarlo. El PDF18/10 tiene60páginas analizadas y patrones inventariados; chat.txt del25/10 tiene28recorridos auditados (445mensajes). Esto no equivale a28 replays completos aprobados. La auditoría histórica conserva diagnósticos fuera de la suite verde y pendientes que otras tandas trataron parcialmente; no interpretar ni el conteo global como cobertura total ni las cifras rojas antiguas como resultado actual sin reejecutar.

Estado de despliegue al iniciar: staging231 `1f0a2f8c` verificado en la tanda anterior;232 publicada sin desplegar. Producción no modificada en esta tanda. Las pruebas gratuitas simulan modelo/mapa/persistencia; no acreditan reconocimiento real de toda dirección o audio.

Siguiente prioridad de trazabilidad: reejecutar aislados los diagnósticos de auditoría25/10, pedido+transferencia y chats de tarde; enlazar cada recorrido CHAT2510 con spec y resultado vigente. Mantener los fallos fuera del inventario verde claramente visibles, promoverlos solo después de corrección y recorrido completo. Después ampliar negativas al nombre del perfil y correcciones condicionales. No declarar piloto por número de tests.

## Reejecución histórica final — pendientes confirmados

Los tres diagnósticos opt-in se ejecutaron DESPUÉS de la global, sobre la misma fuente:28casos,6verdes/22rojos. Evidencia resumida sin datos privados: `whatsapp-historical-recheck-2610.json`; salida local `/tmp/ppp-233-historical.json`.

- Auditoría chat25/10:0/12. Cortesía/envase dejan carrito vacío, adicional de arroz omitido, dos porciones no conservadas, negativa con typo no elimina y cambio de ejecutivo añade unidad.
- Chats de tarde:2/8. Negación múltiple pasa; compra de arroz/pollo/bebida todavía se separa en dos unidades (ya no siete), cortesía de domicilio se guarda como dirección y dos sopas repartidas quedan en tres unidades.
- Pedido+transferencia:4/8. Formulación explícita pasa; las cuatro versiones del mensaje largo real pierden la sopa independiente y dejan Ajiaco en el ejecutivo.

Estos22fallos NO se incluyen en las19.907 regresiones verdes ni se presentan como corregidos por233. Son11 formulaciones fallidas, cada una probada con agente simulado off/on; no22chats distintos. No se atribuyen al modelo real: el arnés lo simula. No se acredita que233 los haya introducido; son diagnósticos previamente abiertos reejecutados.

**Cambio de prioridad:** antes de nuevas familias de perfil, cerrar el pedido largo real de sopa+ejecutivo (diagnóstico183/186), reparto de sopas, cortesía/destino y reemplazos/cantidades de184/194. Una familia se cierra solo con reproducción del texto completo, variantes de otros menús, respuesta/carrito/estado y DTO. Después completar mapa CHAT2510→prueba vigente por cada recorrido; no usar pruebas de un fragmento para cerrar todo el chat. Preservar controles positivos. Los restantes PDFs/adjuntos tampoco se declaran totalmente resueltos.
