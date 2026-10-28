# Revisión independiente de tanda 237

Base Git observada: `e132dd91`, con cambios locales de tanda 237 aún sin publicar. Producción no modificada.

La ejecución `/tmp/ppp-237-global.json` terminó con 20.021 pruebas aprobadas y 3 fallidas sobre 20.024, en 306 suites. Los tres fallos son timeouts de 5 segundos en `whatsapp-general-accuracy.spec.ts`, familia `17 Pero dame`, agente desactivado, modalidades de ráfaga. Esto NO acredita una global aprobada ni demuestra todavía que el fallo sea solo carga.

Repetición de esa familia sin aumentar timeout ni alterar aserciones: 8 aprobadas, 4 timeouts, 68 omitidas (72,03 s). Evidencia: `/tmp/ppp-237-rerun-17-independent.json` y `.log`. La cuarta afectada es `previo=true rafaga agent=false`.

Diagnóstico adicional de un único recorrido (`previo=false rafaga agent=false`) con límite de ejecución de 15 s, sin modificar archivos de test: aprobado en 3.374 ms. Evidencia `/tmp/ppp-237-timeout-diagnostic.json`. Sugiere sensibilidad al contexto de ejecución, pero NO demuestra la causa ni acredita los otros tres recorridos. No aumentar el límite del repositorio para ocultarlo. Revisar aislamiento de temporizadores y costo de ejecución; repetir el bloque con su límite normal antes de cerrar. La global permanece fallida.

## Siguiente bloque: reparto de unidades sin extras accidentales

Priorizar el diagnóstico histórico «dos sopas grandes bien calientes, una con arroz y la otra con arepita». Reproducir antes de corregir, con sopa, bowl y pasta de catálogos sintéticos:

- Total dos unidades, una por cada nota distinta; temperatura compartida en ambas.
- Mismo pedido con carrito previo y durante nombre, dirección o pago: conservar el resto y retomar el paso pendiente.
- Corrección posterior de una sola unidad sin duplicar ni alterar la otra.
- Diferenciar acompañamiento de compra explícita: «y una porción adicional de arroz» debe conservar el extra.
- Consulta intercalada sobre precio o contenido: responder sin comprar ni perder la distribución.
- Cierre simulado: comprobar cantidades, opciones y notas en el DTO, además del mensaje y carrito.

No afirmar resueltos todos los chats/PDF. Las pruebas de tanda 237 inspeccionadas validan carrito y algunas respuestas, pero no incluyen cierre/DTO en sus cinco familias; añadir esa evidencia antes de extrapolar a conversaciones completas.

## Cierre posterior

Suite de ráfagas completa: 80/80 con timeout normal, `/tmp/ppp-237-burst-final.json`. Suite de reparaciones ampliada con 12 cierres:42/42, `/tmp/ppp-237-checkout-final.json`. TypeScript general/build y Node92 aprobados. No se modificó runtime en esta revisión. La validación consolidada conserva explícitamente la primera global fallida y reemplaza por nombre las suites reejecutadas:20.036/306, sin sumar duplicados. No atribuir el pase a una corrección de temporizadores ni acreditar rendimiento productivo.
