# Auditoría 188 — dos recorridos nuevos del 25/10

Actualización189: los6fallos focales de dirección/referencia se corrigieron y los8diagnósticos se promovieron a whatsapp-new-chats-2510.spec.ts. Ver whatsapp-pinned-reference-validation-2510.md. El resto del análisis conserva pendientes; los resultados siguientes describen la base188.

Base: e3590984, staging. Análisis del archivo aportado (recorrido 15:54–16:17) y del chat anterior de portería. No son evidencia de que producción use esta base. No hay corrección runtime ni despliegue en esta auditoría.

Actualización 190: reproducción local demuestra extracción de «Es» desde «Es un pollo…»; corregida validación y recuperación de nombre previo. Recapitulación focal evita «no manejamos Ósea1» y conserva carrito; no se reprodujo duplicación en esa semilla. Ver whatsapp-restatement-validation-2510.md. La compra inicial parcialmente fallida sigue pendiente.

## Qué funcionó en el recorrido de los pollos

- Respondió disponibilidad de plátano y recordó que faltaba elegir los pollos.
- Diferenció preparación frita/asada sin inventar equivalencia.
- Expuso los cambios parciales guardados cuando falló la compra larga.
- El carrito final contiene un pollo frito, uno broaster y dos plátanos. Subtotal 108.000 y domicilio 5.000 suman 113.000 correctamente para los precios de ese chat.
- Recibió ubicación, efectivo y confirmación. Un comprobante emitido no acredita fidelidad completa del pedido.

## Fallos y contratos que faltan verificar/corregir

1. **Compra distribuida con acompañamientos.** La frase de un pollo de cada preparación, uno con papa y otro con yuca, falla parcialmente. Debe conservar dos pollos en total, dos plátanos y solicitar solamente la asignación del acompañamiento si no es inequívoca. No cobrar yuca/papa aparte sin intención explícita. Pendiente reproducción completa.
2. **Nota residual.** «con queso y bocadillo por» mezcla nombre del producto y cortesía en una nota. No es una instrucción de cocina. Pendiente rastrear extractor y DTO; el recibo sin notas no demuestra que estas se perdieran en cocina.
3. **Reformulación frente a compra.** «Ósea 1 y 1 y los 2 plátanos» no es otro producto ni debe sumar otra vez los plátanos. La corrección posterior parece reflejada en el carrito final, pero se debe probar idempotencia y cantidades en cada turno. Pendiente reproducción.
4. **Total contextual.** Tras «No señor, así está bien», «Cuánto sería» debe informar subtotal y aclarar que falta domicilio, sin preguntar de cuál producto habla. Prueba focal nueva.
5. **Nombre inválido.** El resumen y la orden muestran «Es». No hay un nombre aportado inequívocamente en el fragmento. El origen puede ser extracción o datos previos: no está demostrado. Reproducir con nombre vacío y con nombre previo, inspeccionar cada transición y no atribuirlo aún a «Es un pollo...». Nunca presentar «Es» como destinatario confirmado; tampoco reemplazarlo por un nombre inventado.
6. **Solicitud de referencia durante confirmación.** «Puedes poner en la direcciones esta porfa» requiere una pregunta concreta; no volver a «¿Algo más?». Reproducción roja en staging.
7. **Referencia comercial después del pin.** Conservar nombre del lugar junto al pin exacto y tarifa, sin interpretar 1972 como cantidad/código, y retomar confirmación. Probar solicitud+respuesta y referencia directa por separado. Reproducción focal nueva.
8. **Siguiente paso.** El carrito repetido tres veces ante referencia/agradecimiento no responde al cliente. Confirmar solo con intención de confirmación y con datos requeridos válidos. No cambiar este contrato a un cierre automático.

## Chat de portería

Acertó variante, nombre explícito, efectivo, cálculo 16.000 + 2.000 y confirmación. Conservó una instrucción de entregar en portería. Fallos:

- Mientras pide nombre, recibe y almacena dirección pero responde «Primero necesito... Después te pido dirección»: contradice lo que acaba de aceptar. Reproducción roja.
- Al completar calle se pierde el nombre del conjunto en el resumen. Verificar por separado fusión de referencia y calle sin heredar referencias de destinos distintos. La prueba encadenada actual se detiene en el primer fallo: no acredita aún este segundo fallo en staging.
- «Efectivo 50» queda como texto de cambio. Definir normalización contextual de 50 mil frente a importes ambiguos/insuficientes; no asumir por cualquier número ni convertirlo en producto. Verificar efectivo y cambio en DTO/comprobante, sin declarar pérdida solo por ausencia visual.

## Plan ejecutable

1. Referencias de entrega: solicitud explícita, referencia siguiente, pin exacto, tarifa intacta, estado de confirmación y DTO. Variar restaurantes y nombres con números. Controles: nueva calle, cambio real de destino, pregunta, pago, cancelación y compra intercalada. Evitar capturar cualquier frase siguiente como dirección.
2. Datos fuera de orden: dirección mientras espera nombre, nombre mientras espera dirección/pago, pregunta de costo sin guardar como nombre; conservar datos ya recibidos y pedir solo el faltante.
3. Compra distribuida/reformulación: reproducir conversación desde saludo y también desde estado sembrado. Dos pollos/dos hamburguesas/dos platos vegetarianos con acompañamientos diferentes; «o sea», «es decir», «uno y uno» y repetición no incrementan cantidades.
4. Respuesta sobre total y cortesías: subtotal sin domicilio, total con tarifa válida; no inventar un total final ni perder checkout.
5. Cierre completo simulado: comprobar respuesta, carrito, opciones/notas, destinatario, pin/referencia, efectivo/cambio y DTO. Mantener casos de errores parciales; no basta la respuesta del modelo diciendo «corregí».

## Evidencia y límites

Diagnósticos opt-in: src/whatsapp/whatsapp-new-chats-2510.repro.ts. Agente simulado on/off; persistencia, mapas, Meta y órdenes simulados. No inferencia pagada ni WhatsApp real. Los casos rojos están fuera del inventario verde y NO cuentan como regresiones aprobadas. Ejecutar:

    npx jest --testRegex='whatsapp-new-chats-2510\.repro\.ts$' --runInBand

Resultado: 8 diagnósticos ejecutados, 6 fallidos y 2 aprobados. La consulta «Cuánto sería» tras cerrar compras pasa en ambas modalidades en esta semilla; no acredita todavía el recorrido completo del archivo. Fallan respuesta de portería, solicitud de referencia y referencia directa, en ambas modalidades. Evidencia local: /tmp/ppp-188-diagnostic.json y .log. No se repite global sin cambios compartidos. Última global runtime sigue siendo 187: 18.409 pruebas/255 suites. No afirmar que todos estos chats están resueltos ni que se alcanzó piloto por conteos.

TypeScript general (`npx tsc --noEmit --incremental false`) aprobado. No cambios en código de ejecución; no se ejecutó otra global ni se desplegó.
