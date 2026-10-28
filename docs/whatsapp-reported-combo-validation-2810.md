# Tanda255: combo interceptado por sabor y comprobación del arroz

Base `f606a423beb81a5b79169f46f6994ecaf9fd187a`, staging,28/10/2026. Reporte del usuario: tras reiniciar, «quiero un pollito frito en combo con gaseosa colombiana con las arepas fritas» ofreció tamaños de gaseosa y terminó comprando solo la bebida. No se guardan datos de identidad/contacto/domicilio del reporte.

## Causa y corrección

Reproducido2/2 con router completo, catálogo PPP y agente simulado off/on: tryAskAmbiguousFlavorDrink se ejecutaba antes de resolver el plato y absorbía Colombiana. Esa decisión precede a la inferencia; el caso no demuestra un deterioro de Luna frente a Sol. No se realizó comparación real ni se cambió modelo.

El atajo de sabor deja pasar comida con bebida. Un pedido explícito de combo con una palabra distintiva de variante del catálogo en la cabecera antes de «con», de una sola familia se procesa con el manejador existente de variantes antes del atajo y del modelo. Conserva preparación, opciones incluidas, cantidad y validaciones. No se aplica ese adelanto a preguntas, pedidos claramente múltiples ni apartes/adicionales/extras. No hay IDs, nombres comerciales ni precios PPP en la lógica nueva. Se reutiliza resolución de familias por catálogo para Pollo, Pescado y Tofu en cartas de prueba.

## El arroz no se perdió

Consulta de solo lectura en el servidor encontró el episodio en staging; no hubo coincidencia en producción. Se exportó una traza estructural sin teléfonos/nombres/domicilios. Una lectura acotada adicional de los turnos de comida faltantes mostró: tras «1» se respondió «Listo Arroz Con Pollo»; después llegaron «que hay de tomar veci» y «que jugos naturales tienen», y entonces se listaron Jugos. El fragmento pegado omitía esos turnos. No se acredita un fallo de selección de arroz ni se cambia navegación por una hipótesis no confirmada.

Dos controles siembran las categorías mostradas en el reporte, eligen4 y1 y verifican arroz en carrito, no una categoría nueva. Se simula respuesta de agente y se comprueban pendientes. El saludo inicial y la lista completa no son un nuevo replay de inferencia real.

## Validación

32 regresiones nuevas:2 del combo reportado con DTO y opciones;2 de navegación desde lista sembrada;24 controles en tres cartas × agente off/on × combo, dos combos, bebida suelta y consulta;2 jugos con base pendiente y2 controles de combo sin preparación explícita. Foco final136/136 en5suites. Los controles de compra verifican respuesta, carrito y DTO. Modelo, Meta, mapas, persistencia y órdenes simulados.

Intentos de desarrollo no son aprobación: primer montaje de navegación clasificaba Porcion De Arroz como Arroces y dependía del saludo de un modelo simulado; se corrigió la semilla al listado observado y la pertenencia de catálogo. Otros controles supusieron que Colombiana sola siempre abre tamaños; el sistema existente puede usar400ml por defecto. Se reemplazaron esas expectativas no acreditadas por elección explícita de tamaño y ambigüedad real de base de jugo. No se cambió runtime para satisfacer esos supuestos.

Global y TypeScript se registran en `whatsapp-batch-255-validation.json` al cierre. Cero llamadas pagadas; presupuesto267/256/11 y espejo intactos. No cambia modelo, esquema, env/compose, Main ni producción244. Aprobación automática con mocks no equivale a evaluación independiente o aptitud de venta. Casos múltiples/extra separados permanecen en sus manejadores existentes; no se declara su cobertura a partir de este único reporte.

La primera global de desarrollo detectó1regresión en el flujo antiguo «Me regalas un combo → De broster → Coca Cola → Y arepas fritas». El adelanto se restringió a una variante nombrada mediante palabras distintivas del título del catálogo antes de las opciones incluidas. La expectativa histórica no se cambió; se añadieron dos controles. Ese bloque fallido no cuenta como aprobación; se repite el inventario completo sobre la fuente final.

El control de combo sin preparación con agente simulado comprueba solo la entrada sin compra prematura; el recorrido posterior con «broster» se acredita con agente desactivado y la regresión histórica sin modificar. No se exige al modelo simulado una inferencia que no realiza.

Trazabilidad histórica: el mensaje y manejador de aclaración de sabor vienen de `59064dc39` del12/10; el cambio de texto económico/modelos es `9f94ef70` del28/10. Esto respalda que el mecanismo es anterior al cambio de hoy, además de la reproducción antes de inferencia. No es una comparación estadística de modelos.
