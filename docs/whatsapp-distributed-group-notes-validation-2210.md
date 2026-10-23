# Tanda 121 — notas por grupo

## VIGENTE — tanda 121: notas separadas por grupo y correcciones parciales (22/10)

Base cead288b, staging. 72 regresiones nuevas, tres menús sintéticos y agente simulado on/off, todas hasta DTO simulado. Cuatro unidades distribuidas en dos o tres grupos: notas sin tomate/con ají/sin sal, frases completas o por turnos, con/sin conjunción y comas; misma bebida con notas distintas; recuperación de sabor desconocido; cambio de una sola unidad en pago/confirmación; cubiertos, salsa aparte e hielo. Conserva nota común y opciones compatibles, suma cuatro unidades, no mezcla notas entre grupos y no crea orden antes de confirmar.

Los primeros 36 casos pasaron sin cambios. Al ampliar redacción se reprodujeron 12 fallos (744 aprobados): «con Pepsi con ají» perdía la nota al consumirla como parte de la bebida. Se retira exclusivamente la opción resuelta del catálogo al inicio del grupo antes de extraer las notas; no se añade excepción por bebida, producto o restaurante. Los grupos con la misma bebida y notas distintas permanecen separados.

Foco final 774/774 en cinco suites; TypeScript general/build OK; Node 92/92. Global final 16.459/16.459, 192 suites, inventario exacto, 490 hashes intactos, 565,33 s. Cero API pagada, WhatsApp u órdenes externas. Modelos y servicios externos simulados; no acredita mejora de transcripción/visión real ni calidad general para venta.

Tandas 120/121 publicadas y desplegadas juntas en staging: 17bc27a7, imagen 2a57360d…, verificado 22/10 a las 23:41 Bogotá: running/healthy, cero reinicios, health OK, DB connected y circuit CLOSED. publicChat=true, outbound=true, canal configurado, staging=true y orderEvents=false efectivos. Producción conserva imagen ef426c93…; Main intacta. Rollback ppp-nest-staging:rollback-before-17bc27a7; bin/ privado, bases y volúmenes preservados. Mantener acceso público de staging y eventos de cocina bloqueados. Evidencia: [tanda 121](whatsapp-distributed-group-notes-validation-2210.md).

Siguiente: varios atributos en cada grupo (bebida+término/salsa/temperatura), cambios de opinión antes de completar el reparto y notas/contacto intercalados. Contrastar respuestas sin cantidad, preguntas y disponibilidad cambiante. No usar conteos para declarar vendible ni cambiar Main sin solicitud explícita.

## Evidencia y reproducción

Pruebas en `src/whatsapp/whatsapp-related-combo-offer.spec.ts`: nueve escenarios × tres catálogos × agente simulado on/off (54), más tres notas de contraste × tres catálogos × ambos modos (18). Compra, reemplazo por combo, reparto, cierre y confirmación pasan por el router completo con dependencias simuladas. Se verifica respuesta, carrito, pendingAttribute, estado conservado al corregir, producto/atributos/notas y DTO de cuatro unidades. Todos los recorridos prohíben crear orden antes de confirmar.

- `/tmp/ppp-121-baseline.json`: 36/36 aprobados en implementación anterior.
- `/tmp/ppp-121-targets.json`: 12 fallidos/744 aprobados tras extender redacción sin conjunción y comas.
- `/tmp/ppp-121-fixed.json`: 54/54 tras corregir.
- `/tmp/ppp-121-targets-final.json`: 774/774, cinco suites, incluye las 72 nuevas.
- `/tmp/ppp-121-tsc-final.log`, `/tmp/ppp-121-build-final.log`, `/tmp/ppp-121-node.log`: controles aprobados.
- `/tmp/ppp-121-global-summary.json`: 16.459 aprobadas, 192 suites, 490 hashes, inventario exacto y fuente intacta; 565,33 segundos.

No sumar ejecuciones solapadas como pruebas independientes. Global ejecutada una sola vez sobre la fuente final: ráfagas/general-accuracy en runInBand y resto con cuatro workers excluyendo esa suite. No editar ni ejecutar otra suite durante global. Helper temporal `/tmp/ppp-121-global.py`; no depende de API real.

## Límites

Separa la opción confirmada al inicio del grupo de la nota posterior. No acredita toda redacción libre ni varias opciones mezcladas antes de cada nota. Los nombres y precios ficticios son fixtures; producción resuelve por catálogo. La disponibilidad, nombres/contactos intercalados y varios atributos se dejan como próxima tanda específica. Los despliegues se verifican aparte de publicar Git.

## Despliegue verificado

Evidencia local `/tmp/ppp-121-deploy.log` y `/tmp/ppp-121-deploy-verified.log`. Código `17bc27a7c4284039db5609314127f7b03e67bd31`; imagen staging `sha256:2a57360def71cd459003c43bd2e9077d648353389a5ddecef1f3eeef1c2ce56a`. Verificación 2026-10-23T04:41:11Z (22/10 23:41 Bogotá). Imagen de producción inalterada `sha256:ef426c93966a809c007cfb0eb9bf0b83a3e2ef4b137498b23a632e8f61b7d613`. Se ejecutó únicamente compose staging/up api; no se eliminaron orphans ni se tocaron datos. Commit posterior de documentación no requiere rebuild.
