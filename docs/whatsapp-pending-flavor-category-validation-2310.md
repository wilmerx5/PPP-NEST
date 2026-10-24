# Tanda159: consultar categorías durante una elección

## VIGENTE — tanda159: categorías durante sabor pendiente (23/10)

Based3239552, solo staging.18 conversaciones nuevas: tres menús (bowl/gaseosa+sopas, pizza/jugo+postres, arroz/refresco+entradas)×categoría disponible/agotada/ausente×agente simulado on/off. Baseline16 fallos/2 aprobados: categoría vacía borraba pendingAttribute o llegaba al filtro de preguntas ajenas al menú; repetía opción sin responder. Se adelanta consulta de catálogo ante compra pendiente, reconoce forma «qué [categoría] tienes» y responde ausencia sin limpiar selección. Excluye preguntas de sabor/opciones/tamaño/ingredientes del reconocimiento genérico. Listado informativo sin números, recordatorio de sabor, conservación de dos bebidas/notas y cierre con DTO exacto.

Foco96/96,9,626s; TypeScript general/build OK, Node92/92. Global17.485/17.485,228suites,526hashes,606,52s; inventario exacto/fuente congelada. /tmp/ppp-159-global-summary.json y /tmp/ppp-159-{baseline,focus,tsc,node}.log. Cero API/Meta/órdenes externas. Publicado solo staging; tandas158–159 pendientes de deploy agrupado. Último servidor verificado0a3e2ae4 (154–157); Main/producción intactas.

Próximo: consultar otra categoría y pedir uno de sus productos sin perder bebida pendiente; respuesta numérica tras listado informativo; ingredientes de otro plato mientras elige sabor; «qué tienes de…» y otras formulaciones. Esta tanda verifica consulta y regreso al sabor por nombre, no esas extensiones. Modelo/mapa simulados, contraste real aún pendiente; no declarar vendible por conteos. Ver whatsapp-pending-flavor-category-validation-2310.md.

## Reproducción y corrección

Se parte de un plato en checkout de pago y se piden dos bebidas sin hielo, que requieren sabor. La consulta de sopas/postres/entradas debe contestar disponibilidad sin cambiar carrito, cantidad, notas o atributo pendiente. Con categoría disponible se lista el producto; agotada o ausente se informa que no se encuentran opciones disponibles. Luego sabor explícito, pago y confirmación contra mock de orden: un plato, dos bebidas del sabor elegido y notas originales; contacto/dirección conservados.

El primer run dejó 16 fallos/2 verdes. Un primer ajuste en el bloque tardío dejó ocho fallos: el filtro de asuntos ajenos al menú consumía antes postres/entradas sin resultados. La resolución informativa se movió delante de ese filtro y antes de borrar elecciones. No contiene nombres, IDs ni precios de restaurantes específicos en runtime. No se crean compras al consultar.

## Verificación y límites

Nueva suite src/whatsapp/whatsapp-pending-flavor-category.spec.ts: tres cartas×tres disponibilidades×agente simulado on/off. Estado inicial de pago y carrito sembrados; la elección de sabor sí se abre por el router real. Servicios de IA/mapa/orden externos simulados. ignoreBusinessHours=false y negocio abierto simulado preservan availableNow=false para probar agotados.

Foco incluye pending-flavor-category, pending-drink-questions y side-ingredient-paraphrases; npx jest --runInBand --runTestsByPath con esos archivos. TypeScript general/build y node --test scripts/*.test.cjs. Global /tmp/ppp-159-global.py a fuente congelada, ráfagas aisladas y resto cuatro workers. Inventario exacto, sin suites duplicadas. Documentación posterior no requiere repetir global.

No acredita nueva compra en categoría consultada, elección numérica ni todas las maneras de preguntar. Siguiente tanda debe probar esos caminos antes de ampliar reglas. No ejecutar globals concurrentes ni llamadas pagadas por defecto. Mantener staging y agrupar deploy158–159 con siguiente cierre si corresponde.
