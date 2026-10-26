# Tanda 201 — notas en combos plurales

Base: `27b49bf8`, rama staging. Sin llamadas pagadas, Meta, órdenes externas ni despliegue. Main preservada.

## Fallo reproducido y cambio

Los dos casos de arroz de tanda 200 pierden «sin cebolla». La traza confirma que `handleProductWithVariants` recibe el texto completo y que `orderKitchenNote` devuelve undefined. No se pierde la nota en persistencia: la extracción no elimina el título del catálogo porque «combos» no coincide con «Combo». El componente «con medio pollo» hace que los filtros posteriores interpreten varios platos.

El enmascarado del título admite ahora combo/combos. Sigue basado en el nombre completo del producto elegido; no contiene nombres, IDs o precios específicos de PPP. No cambia selección de bebida, cantidades ni política de sustituciones.

## Cobertura

El diagnóstico de dos casos se promueve sin duplicación a `whatsapp-combo-note-loss.spec.ts`, ampliado a 18 casos: 12 conversaciones (3 menús × agente simulado off/on × sin cebolla/sin ensalada) y 6 controles de título sin nota, singular/plural. Las conversaciones verifican respuesta, carrito, estado, bebida, cantidad y cierre con DTO simulado de dos unidades. No miden comprensión de un modelo real: el agente está simulado.

Baseline de los dos originales: 2 fallos; después: 2 aprobados. Foco final con suites de combos anteriores: 55/55. TypeScript general/build y 92 pruebas Node aprobados. Evidencia: `/tmp/ppp-201-trace.log`, `/tmp/ppp-201-first.json`, `/tmp/ppp-201-focus-final.json`.

## Hallazgos que siguen abiertos

La ampliación con «con bastante ají» descubrió otros caminos: arroz pierde la nota, pasta incluye texto redundante del título/bebida, bowl la conserva. Se guardan seis diagnósticos opt-in en `whatsapp-combo-intensity-note.repro.ts`: 2 aprobados, 4 fallidos. En el primer intento el oráculo no toleraba ají/aji; eso se corrigió antes del resultado final. No sumar estos diagnósticos al inventario aprobado. Evidencia `/tmp/ppp-201-intensity.json`.

Siguiente: trazar esos caminos antes de modificar reglas; exigir nota específica por línea y DTO, mantener sin notas los ingredientes del nombre. Persisten los ocho diagnósticos de composición PPP de tanda197 y el trabajo pendiente de costos: observabilidad199 aún no desplegada, faltan audio/visión/legacy y asociación a orden. No hay ahorro real medido en esta tanda. No declarar piloto/vendible por conteos.

## Global

Aprobada: 18.732 pruebas en 267 suites, 575 hashes sin cambios, inventario exacto, 694,13 segundos. Evidencia `/tmp/ppp-201-global-summary.json`. Cierre el 26/10 (Bogotá), trabajo iniciado el 25/10. Publicación solo en staging; sin despliegue.
