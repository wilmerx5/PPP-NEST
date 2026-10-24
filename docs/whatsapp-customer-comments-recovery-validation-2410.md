# Tanda169 — comentarios sin interrogación durante el pedido (24/10)

Base4092e1c6, solo staging. Objetivo: reconocer una objeción o aviso de incomprensión sin tratarlo como nombre, pago o sabor, y permitir continuar con el pedido conservado.

## Fallo reproducido

Baseline funcional definitivo: 54/54 fallaron. «Eso está muy caro», «No me entendiste» y «No me respondiste lo que te pregunté» entraban en validación de nombre, repetición de pago o rechazo de opción. No se atribuye al proveedor de IA: ambos modos usan dependencias simuladas.

Antes del baseline definitivo se corrigieron dos errores de tipado del fixture (el nombre vive en la conversación, no en sessionData; cadena vacía para nombre faltante), y la preparación de una selección pendiente: la descripción debía indicar sin bebida y el atributo debía requerir elección. Los logs baseline/baseline2 son compilación, baseline3 mezcla preparación fallida y fallos de respuesta; la evidencia funcional es baseline4.

## Cambio

El manejador existente de comentarios básicos reconoce tres familias de frases completas: objeción de precio, incomprensión y pregunta sin responder. Responde al comentario y conserva el recordatorio de la etapa pendiente. No modifica productos, cantidades, nombre, dirección ni opciones. La objeción de precio ofrece revisar precios/opciones, sin inventar descuentos. La incomprensión pide precisar el cambio; no afirma haberlo realizado. La pregunta omitida solicita aclararla; no inventa una respuesta.

Las expresiones están ancladas a toda la frase para no absorber instrucciones posteriores, consultas o correcciones específicas. Se exige una frase de precio («está caro»), no la palabra aislada «caro», que podría ser un nombre o parte del catálogo. Sin IDs/nombres de productos en runtime.

## Cobertura

108 recorridos nuevos: tres menús sintéticos × agente simulado on/off × nombre/pago/sabor × seis paráfrasis. Comparan respuesta, estado, carrito, nombre, dirección y opción pendiente. Continúan con el dato/sabor solicitado, pago y confirmación simulada. Verifican DTO exacto de uno o tres ítems, notas sin cebolla/sin hielo, sabor, nombre y dirección.

No se sembró un carrito incorrecto: esta tanda acredita reconocimiento y continuidad, no reparación de un error previo. No acredita interpretar cualquier comentario libre, recuperar automáticamente una pregunta histórica, errores de voz, etapas de teléfono/dirección, ni mensajes mezclados con correcciones específicas. El modelo devuelve una respuesta fija sin acciones; no evalúa inferencia real. El inicio del checkout está sembrado.

## Resultados

Foco final162/162 (108 nuevos +54 de168), dos suites,34,12s. TypeScript general/build OK; Node92/92. Evidencia /tmp/ppp-169-{baseline4,focus-final,tsc,node}.log. Cero llamadas pagadas, WhatsApp externo u órdenes reales.

Global17.815/17.815,238suites,536hashes,774,28s. Inventario exacto y fuente congelada. Evidencia /tmp/ppp-169-global-summary.json y reportes burst/rest. Publicación solo staging; despliegue agrupado166–169 pendiente de verificación. Main intacta.

## Siguiente

1. Mismas familias durante teléfono y dirección, con dato de contacto válido antes y después del comentario.
2. «No me entendiste, deja solo uno» y «no respondiste: ¿qué trae?» deben resolver la instrucción/consulta específica, no pedir repetirla genéricamente.
3. Desacuerdo con tarifa de domicilio junto con corrección de dirección: recalcular solo al resolver la dirección y no inventar exención.
4. Si existe una pregunta anterior identificable, valorar recuperarla para no hacer repetir al cliente; probar contexto vencido y varias preguntas antes de asumir cuál era.

No declarar listo para vender por el número de pruebas; contraste real controlado sigue pendiente.
