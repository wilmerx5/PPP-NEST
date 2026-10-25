# Tanda 173 — repetir dirección ambigua sin perder interiores

Base00e7ec3d; trabajo solo staging. Caso pendiente de172: al repetir una calle completa sin apartamento tras mapa ambiguo, se borraba el interior previamente recibido.

## Reproducción y cambio

Baseline18/18 falló por pérdida de apartamento. Corrección general: si la calle canónica coincide con la ya guardada, sigue sin tarifa resuelta y la repetición no aporta interiores, conservar el destino completo anterior. Cambios explícitos, otra calle o nuevos interiores siguen su camino normal. Sin excepciones por conjunto, restaurante ni producto.

24 casos nuevos: tres menús × agente simulado on/off × tres formas de pago (18 recorridos); seis controles de sustitución de calle/interior. Se verifican respuesta solicitando ubicación, sesión sin contaminación, pago persistido, bloqueo de creación mientras mapa ambiguo y DTO final al resolver el mapa. El éxito del mapa se simula al repetir la calle; no acredita ubicación real ni recepción de un pin de WhatsApp. Los controles de sustitución se detienen con mapa ambiguo y no crean orden.

## Corrección de una interpretación anterior

La anotación de172 sobre «Contraentrega anexado a dirección» no demostraba un fallo del router: composeWhatsappOrderAddress añade deliberadamente pago/notas al campo address de la orden (contrato legado documentado). La dirección de sesión permanece separada. Se retiró una regla experimental de pago al comprobar que la ruta existente ya lo guarda correctamente. No se cambia el esquema de órdenes en esta tanda.

Una aserción inicial asumía quantity dentro de dto.items; el DTO actual expande una entrada por unidad. Se corrigió para verificar un único item con productId esperado. Estos errores de prueba y contrato no se atribuyen al producto. Logs /tmp/ppp-173-{baseline,focus,payment-audit,focus-final}.log.

Foco95/95,3suites,22,614s. TypeScript general/build OK; Node92/92. Global18.109/18.109,242suites,540hashes,790,01s; inventario exacto y fuente congelada. Evidencia /tmp/ppp-173-{global-summary.json,tsc.log,node.log}. Publicado solo rama staging, sin despliegue; servidor permanece13261a98(hasta172), agrupar siguiente despliegue. Sin API pagada/Meta/órdenes externas. Main y producción intactas. No acredita producto vendible ni precisión del modelo/mapa real.

Siguiente prioridad: recuperación con pin de ubicación tras nombre de conjunto+interiores, respuesta clara y conservación del destinatario; luego preguntas múltiples durante cierre sin perder datos.
