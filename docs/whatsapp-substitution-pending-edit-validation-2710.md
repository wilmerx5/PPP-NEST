# Tanda 236 — sustitución pendiente frente a cambios del carrito

Base `44bf3917`, staging. Dependencias externas simuladas; sin API pagada, Meta, mapas ni órdenes externas. Main y modelos intactos.

## Cambio

La tanda 235 solo cubría la sustitución en carrito nuevo. Ahora la elección pendiente («En ves de X más Y o Z») se mantiene coherente cuando el carrito cambia antes de responder:

- Quitar el plato dueño de la sustitución descarta la pregunta pendiente; quitar otro producto la conserva.
- Corregir cantidades o preguntar precio/contenido no consume la pregunta ni crea notas.
- Un plato añadido a un carrito existente con su sustitución («Y me regala un X / En ves de …») se agrega como compra única; las alternativas nunca se compran aunque existan como productos con precio.
- Una sustitución suelta sobre un carrito con el mismo plato en varias líneas pregunta en cuál; la respuesta anota solo esa línea.
- Confirmar con pendiente obsoleto se reconcilia antes de bloquear.

Reglas por estructura de frase y catálogo; sin nombres, IDs ni precios de PPP en producción.

## Pruebas

42 conversaciones nuevas (`whatsapp-substitution-pending-edit.spec.ts`): tres menús sintéticos (Ejecutivo Vegetal, Bowl Andino, Pasta Primavera, con alternativas como productos cobrados) × agente simulado off/on × siete caminos (quitar dueño, quitar otro, cantidad, seguimiento, añadido, líneas divididas, consulta). Cada caso comprueba respuesta, carrito, estado pendiente, nota en una sola línea y DTO de orden simulada.

Primera reproducción: el camino «añadido» fallaba en las seis combinaciones (terminaba en exploración de menú, sin agregar el plato), porque el resolvedor multiproducto devuelve null para una sola compra. Se añadió un resultado de una línea solo cuando hay una compra explícita, nombrada completa, con sustitución delimitada.

Foco 70/70 (42 nuevas + 28 de la tanda 235). TypeScript general y de build, Node 92/92 aprobados. Global completa: 19.994 pruebas/305 suites, 691 s, sin fallos; fuente congelada (hash de `src/` idéntico antes y después). Incluye las pruebas de catálogos Falafel. Evidencia local `/tmp/ppp-236-global.json`, `/tmp/ppp-236-src-{before,after}.txt`.

## Límites y siguiente tanda

No acredita varias sustituciones simultáneas, paráfrasis fuera del patrón «en vez/ves de X más/por Y o Z», disponibilidad real de cocina ni inferencia real. Continuar con los diagnósticos históricos abiertos: reparto 2→3, adicionales omitidos, cantidades/negación con errores de escritura, reemplazos que agregan y cortesía/destino.

Publicación solo staging; sin despliegue en esta tanda (staging verificado en 231 `1f0a2f8c`; 232–236 pendientes agrupados). No declarar vendible por conteos.
