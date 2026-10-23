# Tanda141 — elecciones sucesivas y consultas

## Alcance aprobado

18 recorridos nuevos en whatsapp-pending-two-attributes-journey.spec.ts. Tres catálogos de bebidas, dos estados del agente simulado y tres interrupciones. Compra desde vacío → Base2 → precio/nombre/número9 → Sabor2 → recoger → efectivo → confirmar. Se comprueban respuesta, pendiente sin cambios ante interrupción, una unidad con ambas opciones y DTO final. No es una evaluación de respuestas de un LLM real.

Foco78/78 (incluye60 existentes),8,349s. TS general/build y Node92/92 aprobados. Logs /tmp/ppp-141-final-focus.log, /tmp/ppp-141-tsc.log, /tmp/ppp-141-node.log. No cambio de runtime ni necesidad de global/rebuild. Publicar solo staging.

## Hallazgo pendiente y reproducción

Cambiar temporalmente el nombre del segundo fixture de Jugo Natural En Leche a Malteada Artesanal, conservando Base [Entera, Deslactosada] y Sabor [Vainilla, Fresa]. Ejecutar la misma suite. Tras «Quiero un Malteada Artesanal, qué sabores tienes?» y «2», el router añade una unidad con Base Deslactosada y Sabor Vainilla en lugar de mantener la elección de sabor. Fallan seis combinaciones antes de llegar a la interrupción. Evidencia /tmp/ppp-141-fixtures.log. No se corrigió ni se acredita como aprobado: el fixture aprobado usa jugo; el contraste de malteada queda explícitamente pendiente.

Investigar requiresExplicitAttributeChoice/isLikelyDrinkProduct en whatsapp-catalog.service.ts. El criterio de bebida determina si Sabor requiere elección; revisar catálogo/categoría/descripción y contrastes con platos, sin excepción por nombre o ID PPP. Añadir bebidas distintas (malteada, batido, té) y negativos de platos antes de tocar regla compartida. Reproducir antes/después y ejecutar global con fuente congelada si se modifica runtime.

## Ajustes de la prueba, no defectos acreditados

Primer intento no compiló por acceso opcional a pendingAttribute (TS18048); corregido con acceso opcional. Otro intento con combos de comida esperaba dos preguntas aunque la política actual aplica valores predeterminados a atributos restantes: no se declara defecto por esa expectativa. Se eligieron bebidas para comprobar elecciones obligatorias. La malteada sí quedó como hueco comercial pendiente, no se ocultó bajo el resultado aprobado.

## Siguiente bloque

1. Corregir el criterio de sabor explícito con evidencia del hallazgo anterior.
2. Condición de costo más acción independiente: conservar selección condicionada y ejecutar solo la acción independiente inequívoca; probar orden inverso y condiciones que sí abarcan ambas acciones.
3. Contraste real acotado según whatsapp-api-validation-next-2310.md, contabilizando intentos antes de red. Pruebas gratuitas no prueban audio/visión/modelo real/mapas.
