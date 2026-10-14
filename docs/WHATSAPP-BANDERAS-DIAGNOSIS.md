# Diagnóstico: consulta de pollo, corrección y domicilio por referencia

12 de octubre de2026. Basec65d1e60. El usuario confirmó que el transcript pertenece a Main, no a staging. El diagnóstico previo reprodujo patrones en staging y no acreditaba paridad entre versiones. En la continuación autorizada se añadieron regresiones y correcciones únicamente a staging.

## Evidencia

El transcript muestra precio inicial13.000 y carrito posterior16.000; no se ha leído el catálogo efectivo del entorno donde ocurrió. No afirmar cuál es el precio correcto ni atribuir el incidente solo a un deploy antiguo.

Diagnóstico gratuito con router/catalog/guard reales y dependencias externas simuladas, en la versión actual de staging. Catálogo fixture de cuarto broaster15.000; la cifra distinta no afecta al patrón de duplicación. No se reproduce inferencia, geocodificación real ni el saludo. Log /tmp/ppp-banderas-diagnosis-correct-seed.log. Cinco escenarios fallan:

1. "Si regálame un cuarto de broster": cortesía reconocida como producto desconocido "Si regálame"; el plato queda pendiente en vez de agregarse. El caso se ejecutó aislado, no acredita el contexto exacto de la oferta previa del chat original.
2. Tras agregar un cuarto broaster, "Y el medio vale cuanto": crea pendingMatch.intent=order y pide variante. Debía responder precios por consulta sin abrir compra. Si el estilo se puede inferir del contexto, aclarar su referencia; no asumir sustitución o adición.
3. Con un cuarto en carrito y awaiting_payment, "Cómo así y no cuesta 13mil el cuarto de broster": agrega otra unidad. Defecto crítico de intención; una disputa de precio no autoriza compra. Debe explicar precio unitario/subtotal/domicilio, reconocer contradicción previa si la hay y conservar pedido.
4. Con carrito y awaiting_name, "No dame un cuarto": customerName cambia a ese texto. Debe tratarlo como corrección o aclarar, conservando nombre previo; no aceptar cualquier texto como nombre.
5. awaiting_address con referencia almacén bandera sin confirmar, "La dirección en almacén metro bandera": no reemplaza referencia. Debe distinguir nueva dirección de confirmación, conservar local+referencias posteriores y aclarar ubicación si falta información.

El primer diagnóstico tuvo carrito sin agregar por la cortesía y no era un control válido de reclamo con producto existente. Se corrigió el montaje con "Quiero un cuarto de broster" y se comprobócart id6/qty1 antes de los cuatro casos de seguimiento. Solo acreditar este segundo log. Suite temporal eliminada al concluir; no se introducen pruebas fallidas permanentes ni se cuentan como nuevas aprobadas.

## Lectura del transcript

La respuesta de rendimiento fue prudente: no inventó personas por porción. La respuesta a "sí" cuando se pregunta medio de pago necesita aclaración; no debe seleccionar efectivo automáticamente. Lo grave es ignorar después preguntas de precio y correcciones por seguir en checkout.

Perdió referencia de broaster al hablar de medio/cuarto, convirtió consulta en selección, capturó una corrección como nombre y encadenó prompts de dirección/pago que no atendían el mensaje. El importe final elevado fue consecuencia de duplicación además de la discrepancia inicial de precio.

## Próxima tanda necesaria

- Convertir estos escenarios en regresiones permanentes, más un recorrido completo con turnos de consulta, oferta, compra, cambio de opinión, dirección, reclamo y reparación.
- Variar productos/catálogos, versiones con/sin signos, "vale cuánto", "no cuesta X", "ese poco de plata", referencias abreviadas y nombres ficticios de locales.
- Consultas y reclamos antes de mutaciones/prompt rígido; contexto de producto sin compra implícita; corrección de pedido nunca dato personal; referencia de ubicación editable.
- Verificar precios efectivos del ambiente del incidente y respuestas catalogadas frente a texto libre. No fijar13.000/16.000 como regla de producción.
- Tanda pagada/canal después de corregir y pasar regresiones/full/TS. Saldo25usadas/15restantes, cero solicitudes en diagnóstico.

La tanda anterior sigue aprobada en sus1.958casos, pero esta nueva evidencia descubre defectos críticos fuera de esa cobertura. Reabrir puerta de comprensión: no iniciar piloto con clientes hasta corregirlos y verificar recorrido. Un ensayo controlado con personas conocidas puede usarse para diagnóstico, sin confirmación externa de pedidos no aislados.

## Tanda de corrección autorizada

31casos nuevos:10por catálogo en PPP/bowl/pizza + recorrido del chat completo desde saludo y consultas hasta disputa de importe. Modelos/Meta/persistencia simulados. No se copian respuestas libres ni precios13/16del transcript como verdad: fixturePPP15.000. Baseline28casos tuvo22fallos; paths individuales corregidos y el recorrido destapó una oferta de compra vieja que aceptaba "sí" después de consultar barato. Se cancela esa oferta cuando se compara precio y se responde desde productos relacionados del catálogo.

Reglas generales: cortesía "sí, regálame" antes de comprar; preguntas "vale cuánto" como precio; consulta/reclamo interrumpe checkout sin mutar; corrección "no dame" no captura nombre, resuelve solo una línea existente y cambia cantidad absoluta con límites; fragmento "de X" compatible con una única línea no compra un producto entero; referencias de locales actualizan destino pendiente, sin confirmar coordenadas ni tarifa de mapa no verificadas. La corrección no modifica pedidos completed/closed/human ni enlace MP activo. No hay excepciones nuevas para códigos/nombres/locales.

31focalizadas aprobadas /tmp/ppp-banderas-expanded-approved.log, full/TS en ejecución. No afirmar que el modelo real reprodujo el chat: este es recorrido del router con sus dependencias aisladas. Cero API,15restantes.

Control del full intermedio:3 regresiones en consulta condicional de recargo (65suites,1.986aprobadas/3fallidas); se separó precio de modificación de precio/disputa del producto.61focalizadas finales pasan /tmp/ppp-banderas-targets-final.log. No cambiar expectativas para ocultar errores; /tmp/ppp-banderas-full.log no es aprobación final. Full estable en ejecución /tmp/ppp-banderas-full-approved.log.
