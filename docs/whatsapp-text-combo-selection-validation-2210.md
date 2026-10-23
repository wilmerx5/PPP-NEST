# Tanda 112 — selección textual de combo

Base 8556c983, staging. 42 regresiones nuevas en tres catálogos y agente simulado on/off: «el combo 1 porfa», «el combo 2 por favor», «la opción 2 gracias», «quiero el número 1»; dos unidades con nota y opciones compatibles, 24 DTO simulados, número no ofrecido, consulta de contenido y cambio de precio. Baseline 30 fallidos/66 aprobados; final 108/108. Foco 534/534 en siete suites, TypeScript general/build OK, Node 92/92. Global 80 + 15.961 = 16.041 en 192 suites; inventario exacto y 490 hashes intactos; 561,62 s, sin reintentos.

Se comparte el lector de referencias numéricas entre la lista general y la oferta de reemplazo por combo. Las palabras descriptivas deben pertenecer a todas las opciones ofrecidas. Números fuera de la lista de reemplazo no pasan a selección aproximada del combo preferido: se pide una opción válida conservando carrito. Precio cambiado mantiene la aceptación previa al flujo de bebida. Sin nombres/IDs/precios PPP en reglas.

Límites: selección con cortesía y bebida en turno posterior; no acredita «el combo 2 con Uva» ni selección/cantidad/datos de entrega en el mismo mensaje. Estos casos usan router real y harness con reply/servicios externos simulados; no inferencia real, WhatsApp ni órdenes externas. Main y su despliegue siguen hasta tanda 109, sin cambios. Tandas 111 y 112 desplegadas juntas en staging: 3e87cdac, imagen b4f94e08…, verificado 22/10 a las 20:14 Bogotá, running/healthy, cero reinicios, health OK/DB connected/circuit CLOSED. Rollback ppp-nest-staging:rollback-before-3e87cdac conserva imagen eca86842…. Main y el contenedor productivo conservan ef426c93…; bin/ privado preservado, sin cambios de bases/volúmenes. Evidencia: [tanda 112](whatsapp-text-combo-selection-validation-2210.md).

Siguiente: selección + bebida («el combo 2 con Uva»), selección + cantidad explícita, cambio de opinión durante opciones y contacto/dirección en la misma frase. Mantener controles de número no ofrecido, consultas que no compran y DTO completo.

## Reproducción y oráculos

La ruta de número simple preservaba opciones, pero la referencia textual iba por selección genérica y no abría la misma elección de bebida. Los 24 recorridos de elección textual verifican carrito original intacto hasta completar opciones, cantidad dos, nota conservada, bebida Uva, atributos compatibles cuando corresponde, una sola línea resultante, ninguna orden antes de confirmar y exactamente dos unidades del combo elegido en el DTO. Seis casos de número 9 no ofrecido reproducían reemplazo silencioso por el combo preferido. Seis consultas de contenido conservan el pedido y permiten elegir después. Seis nuevos controles de precio cambiado extienden los controles previos de número simple.

## Comandos y evidencia local

- Foco: whatsapp-related-combo-offer.spec.ts, whatsapp-list-row-count-cancel.spec.ts, whatsapp-several-list-rows.spec.ts, whatsapp-combo-requote-contact.spec.ts, whatsapp-combo-choice-contact.spec.ts, whatsapp-combo-live-menu.spec.ts, whatsapp-combo-price-acceptance.spec.ts; Jest --maxWorkers=4 --silent. 534 aprobadas.
- npx tsc --noEmit; npx tsc --noEmit -p tsconfig.build.json; node --test scripts/*.test.cjs: OK, OK, 92 aprobados.
- Global secuencial por fases: whatsapp-general-accuracy.spec.ts --runInBand (80); resto --maxWorkers=4 (15.961). No fases simultáneas. Inventario listTests completo, sin duplicados, hashes src/scripts/.github/workflows/package.json/tsconfig.build.json idénticos antes/después.
- /tmp/ppp-112-baseline.json, /tmp/ppp-112-focus2.json, /tmp/ppp-112-targets.json, /tmp/ppp-112-global-summary.json, /tmp/ppp-112-burst.json, /tmp/ppp-112-rest.json.

No se cambiaron modelos ni configuración de negocio. No se acredita piloto completo por el número de pruebas. No se editaron archivos durante la global ni se ocultaron fallos: el baseline fallido y el primer foco (seis números fuera de rango fallidos) preceden al resultado final.
