# Tanda 147 — nombre explícito con conjunto sin resolver

Base cdd54a1a con cambios 146 aún sin publicar. Origin/staging conserva esa base durante el desarrollo. La validación final se agrupa para 146 y 147.

## Caso real y diagnóstico

El cliente entrega conjunto mientras se pide nombre; el mapa no identifica el lugar. «Mi nombre es : Laura García» recibe una respuesta aparentemente correcta, pero luego se vuelve a pedir nombre. «Ya te dije que era Laura García» y «Laura García es mi nombre real» se rechazan. El cliente escribe el nombre de ejemplo y la orden termina con ese dato incorrecto. No podemos atribuir esa respuesta productiva exacta a un modelo sin traza; sí se reproduce que los tres formatos no actualizan el nombre.

El capturador explícito solo admitía etiqueta `Nombre:`, `Me llamo`, `Soy`, `A nombre de`; la entrada temprana además filtraba por etiquetas más restringidas. Se normalizan las tres declaraciones adicionales y se pasa por el mismo validador/persistencia/continuación. No se desactiva la validación de nombres ni se aceptan reclamos completos como nombres.

En mapas, el validador de identidad ya ignoraba plazuela/plazuelas, pero no condominio/condómino. El descriptor ahora se normaliza al inicio y se excluye de las palabras de identidad. Los nombres distintivos siguen siendo obligatorios; resultados parciales siguen rechazados. No se agrega equivalencia PPP ni coordenadas hardcodeadas. No se almacena un alias de San Esteban a partir de este chat; hay direcciones distintas en el historial y requieren verificación real.

## Pruebas

24 casos nuevos: 18 conversaciones completas (tres menús/nombres/conjuntos, tres formas de declarar nombre, agente simulado on/off) y seis contratos de identidad de lugar (tres conjuntos, dos descriptores; positivos y negativos en cada caso).

Las conversaciones parten sin nombre, pasan por dirección ambigua, guardan nombre, reciben pago, resuelven dirección numérica y confirman una única orden simulada. Se verifica customerName exacto en DTO, ausencia de repregunta de nombre real y ninguna orden prematura. La respuesta del geocoder se simula; estos casos no acreditan búsqueda Google real ni son consultas pagadas.

Baseline 24/24 rojos, /tmp/ppp-147-name-baseline.log. Tras el ajuste 24/24 verdes, /tmp/ppp-147-name-after.log. Foco ampliado374/374 en seis suites,39,58s; TypeScript general/build OK; Node92/92. Evidencia /tmp/ppp-147-{focus,tsc,node}.log. Global agrupada146–147 en curso: /tmp/ppp-147-global.py. No sumar reintentos.

## Límites / siguientes pasos

- Capturar trazas de búsqueda reales, de forma acotada y sin publicar datos de clientes, para diferenciar resultado ausente, parcial, distante y nombre insuficiente.
- Conservar conjunto/interior como indicación al añadir calle/número; verificarlo con recorridos específicos, sin darlo por resuelto en esta tanda.
- Cubrir variaciones nuevas de corrección de nombre y mensajes mixtos; no convertir cualquier reclamo en identidad.
- Validar respuestas del modelo frente a acciones persistidas en la ronda real acotada pendiente, con presupuesto previo.

Main/producción intactas. Sin API pagada, WhatsApp ni órdenes externas. No declarar vendible por conteos.

## Cierre global agrupado

17.128/17.128 pruebas,208 suites,506 hashes,621,17s; inventario exacto y fuente congelada. Evidencia /tmp/ppp-147-global-summary.json. Publicación/despliegue solo staging pendientes de verificación; Main intacta.
