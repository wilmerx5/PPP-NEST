# Tanda 281: exclusiones compuestas con alcance explícito

Fecha: 29/10/2026. Rama staging, base 8d6c0e53.

## Origen y alcance

Continúa el hueco documentado en280: sus ocho casos compuestos empezaban con una selección preparada, sin acreditar la interpretación inicial. Aquí los recorridos compran los platos y envían la frase completa. Los patrones proceden de las correcciones por plato compartidas por el usuario y del corpus local: `preparacion-y-barrio` (lote1/chat02), `salsas-compuestas` (lote2/chat06) y `cambio-acompanamiento` (lote2/chat10). Son variantes sintéticas; no se afirma haber reejecutado íntegramente esos chats ni los PDF. No se copiaron datos personales ni se obtuvo un corpus nuevo.

Se admite una indicación compuesta de dos o tres exclusiones explícitas: «uno sin cebolla y sin tomate», incluyendo ingredientes de varias palabras como «salsa de tomate». No equivale a interpretar cualquier conjunción: «una sin cebolla y otra sin tomate» distribuye entre unidades distintas, y conserva su ruta previa; preguntas, condiciones y acciones adicionales quedan fuera del parser nuevo.

## Fallos reproducidos

Baseline: 304 recorridos, 304 fallos. Con tres productos, la frase podía anotarse en el último sin preguntar. Con varias unidades de un producto, la exclusión se aplicaba a toda la cantidad en lugar de separar una unidad. Los contratos verifican estado, carrito completo, respuesta y ausencia de órdenes externas.

Ahora se pregunta el plato cuando hay varias líneas, se admite selección por número, nombre o reparación ordinal («perdón, el tercero») y se divide únicamente la cantidad solicitada en una línea con varias unidades. Las notas anteriores y precios se conservan. Una selección con indicaciones incompatibles del mismo ingrediente permanece pendiente, sin añadir la nota. La respuesta muestra el plato y la indicación previa incompatible, en lugar de repetir la pregunta sin explicación. El cliente puede elegir otro destino o retirar la indicación.

## 328 regresiones nuevas

- 128 selecciones: cuatro notas × cuatro destinos/respuestas × dos estados × dos cartas × agente simulado off/on. Las cartas tienen tres platos; incluye revisión final sin confirmar.
- 48 divisiones por unidad: cuatro notas × cantidades2/3/4 × dos cartas × agente simulado off/on.
- 64 selecciones contradictorias: cuatro notas × dos destinos × dos estados × dos cartas × agente simulado off/on.
- 64 interrupciones: pregunta de total, petición de repetir, selector formulado como pregunta y ordinal inexistente; después se resuelve con un nombre válido.
- 8 recuperaciones tras conflicto: elegir otro plato o retirar la indicación pendiente.
- 16 controles puros: cuatro formas positivas y doce límites de sintaxis. No son conversaciones completas.

Foco inicial320/2, recuperación8 (mismo archivo de recorridos, selección por nombre de test) y vecinas390/5. Global final, fuentes congeladas, compilación y despliegue se registran en los JSON de281. No se ha llamado a modelos, Meta ni creado pedidos externos; agente on/off significa doble de pruebas, no inferencia real.

## Límites y migración

La selección entre tres platos ocurre antes de aplicar la nota. No amplía el traslado posterior «no, el otro» de279 a tres líneas, ni interpreta destinos posteriores ambiguos. No cubre «sin cebolla ni tomate», combinaciones arbitrarias de inclusión/exclusión, todas las contradicciones culinarias, audio, transporte real, confirmación externa ni conversión. Las pruebas nuevas usan cartas sin atributos; las existentes siguen verificando otros flujos.

Sin campos de sesión nuevos, SQL ni cambio de modelos. Depende del selector pendiente y las guardas de279–280. Para Kamppo se debe portar el delta pendiente y ejecutar sus adaptadores, no copiar solo el parser. Producción permanece en265. Los datos de los clientes no son un mecanismo de entrenamiento automático: las mejoras son reglas y regresiones revisadas.

La primera pasada global se interrumpió antes de completarse al revisar la claridad de esa respuesta de conflicto. Se añadieron aserciones del motivo y de la nota anterior, se verificaron72casos afectados y se reinició la global completa sobre las fuentes finales. No se combinan resultados de fuentes distintas.
