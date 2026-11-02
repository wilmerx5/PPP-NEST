# Tanda353 — «No así no más» no es un nombre

## Chat recibido durante la validación352

Chat02/11 13:18–13:23: cliente pide combo de pollo frito y arroz chino, responde «No así no más» a «¿Algo más?». Bot registra esa frase como nombre y permite confirmar. Se conservaron productos, cantidades y total; pidió calle/número al no identificar el conjunto. La palabra «celular» quedó como residuo en referencia de dirección: pendiente secundario, no corregido aquí. No se incluyen teléfono, dirección ni identidad reales en fixtures/documentación.

## Causa y corrección

La expresión con negación interna no coincidía con el cierre y pasaba el filtro de nombre. Detector acotado compartido reconoce «(no) así no más/nomás» con puntuación/cortesías, tanto al clasificar cierre como al validar identidad. Así se continúa checkout, se solicita nombre real y se impide reutilizar esa frase si quedó guardada anteriormente. No modifica órdenes históricas ni inventa destinatario. Mensajes mixtos o condicionales no se reconocen como cierre; nombres reales contrastados permanecen válidos.

Baseline46 fallos/66;20 controles ya aprobaban.70 regresiones finales:48 recorridos en dos catálogos × agente off/mock × carrito/pidiendo nombre ×6 cierres;4 nombres contaminados anteriores;6 contratos semánticos;4 mensajes mixtos;4 nombres válidos;4 recorridos desde compra inicial, nombre y dirección hasta pago/confirmación. Los56 recorridos de checkout verifican DTO simulado con nombre real y2 productos; los48 principales también verifican total93.000. Foco431/5 aprobado y final70/1 aprobado. Global conjunta33875/421 aprobada,639 fuentes congeladas e inventario exacto; TypeScript general/build y scripts aprobados. Despliegue agrupado con352 pendiente de verificación.

## Prioridad siguiente

Reproducir y limpiar etiquetas de teléfono en referencias de dirección sin perder conjunto/torre/apartamento ni confundir teléfono y nomenclatura. Después retomar cambio/retirada de producto durante aclaración de nota. Cero inferencia pagada, Meta u órdenes externas; no acredita canal/modelo real. Producción349 y Kamppo321 permanecen fuera del alcance.
