# Plan ejecutable a partir del chat del01/11

Priorización consolidada vigente: `WHATSAPP-UNIFIED-REMEDIATION-PLAN.md`. Las tandas parciales no cierran todos los incidentes de su grupo.

Fuente y diagnóstico: `whatsapp-chats-0111-review.md`. Corpus de diseño: `whatsapp-chats-0111-regressions.json` (51 escenarios, no51 pruebas aprobadas). No asumir que el servidor del export ejecutaba la versión actual de staging.

## 339: resolución colectiva de una selección de opciones

Primer grupo implementado; resultado final y despliegue en evidencias339.51 pruebas nuevas del router/guardas con dependencias externas simuladas. Baseline16/16 fallaba al no aplicar «ambos». No se reprodujo exactamente la secuencia histórica de éxito anunciado seguido de bloqueo: se comprueba explícitamente que la selección desaparezca y que cierre una única orden con DTO/recibo correctos.

Alcance: listas ya ofrecidas con cambios de opción; conserva cantidades y notas. Selecciones por unidades requieren su aclaración específica. Preguntas, negaciones, condiciones y mensajes compuestos no se convierten en aceptación colectiva simple.

## Siguiente: cantidades y productos del reparto

Prioridad0; evidencia438–447. Fixture con ejecutivo frito, ejecutivo broaster y pollo completo coexistentes. Repetir con un catálogo ajeno a PPP. Secuencia: encabezado4, reparto3+1, presa compartida, sopas3+1, exclusión de ensalada, corrección del reparto y cancelación. Verificar cada turno, no solo el recibo:

- El encabezado fija el total y no suma una compra adicional.
- Elipsis de preparación hereda el ejecutivo; no compra un pollo completo.
- Una distribución ambigua de sopas pide esa aclaración sin inventar asignación ni aumentar unidades.
- «Solo eran…» corrige el pedido existente; ninguna compra residual sobrevive por error.
- Confirmación bloqueada mientras falta resolver el reparto; luego DTO con4 unidades exactas y notas coherentes.

Punto de partida: `whatsapp-executive-initial-journey.spec.ts` cubre otro reparto de dos ejecutivos, no acredita este encabezado y combinación3+1.

## Después: ráfagas y aplicación única

Prioridad0;217–242. Reproducir el bagre, sobrebarriga, dos sopas y bebida en mensajes consecutivos y en una ráfaga temporal del receptor. No basta llamar `sendQueued` para certificar coalescencia. Usar temporizadores simulados y mensajes con IDs distintos; contrastar reentrega del mismo ID. Añadir plan de agente simulado con historia obsoleta para comprobar rechazo de duplicación. «Por fis», teléfono y destino no autorizan productos. Comparar tanto omisiones como compras extra.

## Modificación, eliminación y reemplazo compuesto

Prioridad0/1;400–437 y312–333. Dos combos con distinto sabor, una bebida separada legítima y otro plato. Editar sabor conserva número de unidades. Eliminar por atributo retira la línea identificada. «Elimina todo y agrega…» valida el nuevo producto antes de borrar; si falta variante, la transición debe ser explícita y recuperable. Contrastar «agrega otro» para no bloquear compras reales. Preservar notas aplicables y no inventar bebida extra.

## Opciones y notas hasta cocina

Prioridad0;448–459,202–216,368–385. Pepsi a través de elección de variante; bebida incluida frente a adicional; bien asada, sin vinagreta y sin ensalada; primero/segundo y varias unidades. Revisar carrito, resumen, DTO y recibo. Una opción retirada exige aclaración, nunca un default silencioso. No prometer una sustitución de acompañamiento sin respaldo del catálogo/política.

## Contacto, direcciones y lenguaje cotidiano

Prioridad1/2;1–19,79–112,283–292,488–500. Distinguir teléfono de unidades, conservar calle al añadir conjunto/apartamento, normalizar ceros/letras sin modificar la numeración y retener datos enviados durante otra pregunta. Mapas simulados con coincidencia exacta, equivalente y discrepancia real. Tamaño1.5L no puede volver a400ml sin aclaración. Probar `contraentrea`, `confirm,ar`, `pimer`, `frtias` en su estado correspondiente, junto con negaciones y consultas.

## Cierre de cada grupo

Antes/después reproducible; dos catálogos; dependencias aisladas; ninguna orden externa ni inferencia pagada por defecto. Cantidades, atributos, notas, estado, respuesta y creación única. Suite global cuando cambien reglas compartidas. Distinguir aprobado local, desplegado staging, producción y Kamppo. Los grupos anteriores siguen abiertos hasta su propia evidencia; un corpus grande no certifica el motor.

## Avance340 del reparto inicial

Encabezado4, preparaciones3+1 y sopa3+1 conservados; aclaración por número/nombre antes de compra completa.68 controles nuevos; Global33218 pruebas/407 suites, inventario exacto y624 fuentes congeladas. TypeScript general/build y scripts aprobados. Evidencia whatsapp-batch-340-{sources,global-sources,validation,patterns}. Staging340 desplegado y verificado: código `2e827464`, healthy, cero reinicios, API local/pública ok y modelos/configuración privada preservados. Workflow41367782193; evidencia `whatsapp-batch-340-staging-deployment.json`. Controles compilados previos aprobados; cobertura específica340 local. No se declaran cerradas las reparaciones de pedidos ya incorrectos.
