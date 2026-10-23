## VIGENTE — tanda140: selección condicionada y recuperación (23/10)

Base f0820466, staging.24 conversaciones nuevas: tres cartas sintéticas (crepe,sándwich,pasta), agente simulado on/off, condición antes/después de opción, recargo y número9 fuera de lista. Desde carrito vacío se abre selector de bebida; mensaje condicionado o inválido no compra; consulta precio y nombre intermedios preservan pendiente; elección2 explícita permite cierre con DTO de una unidad/opción/nombre exactos y cero órdenes prematuras.

Baseline12 fallos/12 aprobados: «si no cuesta más, ponle…» no reconocía verbo ponle; opción sin verbo «Mora si no vale más» no activaba guarda de condición. Se añade ponle y contexto pendingChoice para permitir condición sin verbo solo con pendingAttribute activo. Split de acción independiente mantiene detección sin ese contexto; callback map explícito evita pasar índice como booleano. Error TS2345 intermedio corregido antes de acreditar pruebas. Regla general, sin nombres/IDs PPP.

Foco126/126,14,522s; TS general/build OK, Node92/92. Global16.986/16.986,204suites,502hashes,575,36s; inventario exacto/fuente congelada. Evidencia /tmp/ppp-140-focus.log (baseline), /tmp/ppp-140-after.log (TS intermedio), /tmp/ppp-140-final-focus.log, /tmp/ppp-140-tsc.log, /tmp/ppp-140-node.log, /tmp/ppp-140-global-summary.json. No sumar focos solapados. Cero inferencias pagadas/Meta/órdenes externas.

Límites: texto serial y servicios simulados; no prueba política comercial real de recargos ni todas las condiciones. No declara recargo cero por ver opción disponible. No acredita modelo real/audio/mapas. Próximas seis tandas en whatsapp-recovery-next-batches-2310.md; prioridad condición+acción independiente y dos atributos sucesivos; contraste real pendiente según whatsapp-api-validation-next-2310.md. No declarar vendible por conteos.

Desplegadas139+140 solo en staging:c82df32d, imagena18b22c5…, verificado23/10 14:35:04 Bogotá. Running/healthy,0reinicios, /api/health OK,DBconnected,circuitCLOSED. publicChat=true/orderEvents=false conservados. Producción conserva imagenef426c93… y0reinicios; Main intacta. Rollback ppp-nest-staging:rollback-before-c82df32d. Bases,volúmenes,bin/ ajeno y privados preservados. Evidencia /tmp/ppp-140-deploy.log y /tmp/ppp-140-verified.log.

