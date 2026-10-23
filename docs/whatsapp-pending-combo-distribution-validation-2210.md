# Tanda 119 — reparto pendiente de bebidas y reemplazo íntegro

## VIGENTE — tanda 119: reparto de bebidas durante reemplazo por combo (22/10)

Base 73816c6b, staging. 36 regresiones nuevas, tres menús sintéticos y agente simulado on/off. Reparto de cuatro combos en Uva×2/Pepsi×2 mediante «los quiero 2 con…», «dos con… y dos con…» o comas. 18 recorridos hasta DTO; 18 controles de suma incorrecta, sabor desconocido y original modificado. Notas y opciones compatibles conservadas; ninguna orden antes de confirmar.

Fallo reproducido: la distribución añadía combos sin retirar el plato original y omitía comprobar que el original siguiera intacto. Se prepara un carrito temporal retirando solo la coincidencia exacta y se guarda después de validar todos los grupos. Se hereda la nota del original. Durante pendingAttribute se reconoce el reparto breve sin «los quiero». Baseline inicial 12 fallidos/12 aprobados; extensión breve 12/12 fallidos antes de corregir. Foco final 636/636 en cinco suites; TS general/build OK; Node 92/92. Global 16.321/16.321, 192 suites, 490 hashes intactos, inventario exacto, 575,15 s, sin reintentos.

Cero llamadas pagadas, WhatsApp u órdenes externas. Main/producción preservados. Tandas 118/119 desplegadas juntas en staging: e4fdb03a, imagen ddefc8e4…, verificado 22/10 a las 22:51 Bogotá: running/healthy, cero reinicios, health OK, DB connected y circuit CLOSED. publicChat=true y orderEvents=false efectivos. Producción conserva ef426c93…; rollback ppp-nest-staging:rollback-before-e4fdb03a, bin/ privado y bases/volúmenes preservados. Acceso público de staging debe permanecer activo y eventos de cocina bloqueados. Evidencia: [tanda 119](whatsapp-pending-combo-distribution-validation-2210.md).

Límites: reparto completo de opciones mientras el producto ya está seleccionado; no cubre por esta tanda varias instrucciones de contacto/notas en la misma respuesta ni grupos enviados en mensajes separados. Siguiente: repartir por turnos («dos con Uva» / «los otros con Pepsi»), consultas entre ambos y cambio de opinión; conservar total y no confirmar un reparto incompleto.

## Evidencia

- `/tmp/ppp-119-baseline.json`: 12 fallos / 12 aprobados. Duplicación del plato original y falta de protección frente a original modificado.
- `/tmp/ppp-119-new.json`: 24 aprobados tras proteger el reemplazo.
- `/tmp/ppp-119-bare-baseline.json`: 12 fallos adicionales de formas breves sin «los quiero».
- `/tmp/ppp-119-targets.json`: 636 aprobados en cinco suites. `/tmp/ppp-119-tsc.log`, `/tmp/ppp-119-build.log` y `/tmp/ppp-119-node.log`: aprobados, Node 92/92.
- `/tmp/ppp-119-global-summary.json`: 16.321 pruebas, 192 suites, inventario exacto, 490 hashes idénticos, 575,15 segundos; ráfagas aisladas y resto con cuatro workers, sin ediciones concurrentes.
- Se comprueba respuesta con ambos sabores, carrito con solo los combos, cantidad total cuatro, notas originales y atributos compatibles. Los 18 DTO válidos contienen exactamente cuatro unidades con sus bebidas y notas.
- Los 18 contrastes conservan tanto carrito como selección pendiente y no crean órdenes. El caso de original modificado simula una edición intermedia y exige aclaración, no un reemplazo sobre estado obsoleto.
- Sin inferencia ni Maps/Meta/órdenes reales. Las cantidades, categorías y atributos se resuelven contra catálogo; no hay excepción PPP en producción.

## Despliegue verificado

Evidencia `/tmp/ppp-119-deploy.log` y `/tmp/ppp-119-deploy-verified.log`. Código e4fdb03acf7dc538ee22440ccf2a7982e4fc47ca, imagen sha256:ddefc8e464e4e6b6b70eea75c0e287b9e18388139d8d6517b79a729509f3d3df, 2026-10-23T03:51:49Z (22/10 22:51 Bogotá). Configuración pública conservada y eventos de cocina bloqueados. Commit posterior solo documental; no requiere reconstrucción.
