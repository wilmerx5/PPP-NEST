# Tanda194 — conservar compra con preferencia opcional

Base4355f281, staging, 25/10. Esta corrección pertenece a los casos pendientes191/192. Los dos adjuntos nuevos se auditan aparte en `whatsapp-evening-chats-2510-audit.md`.

## Cambio y alcance

En una compra inicial inequívoca de varios platos, la preferencia «si hay/tienes/tienen [acompañamiento] mejor» no descarta platos posteriores. Se resuelve la compra completa por catálogo, se añaden las unidades y se pregunta a cuáles de los platos anteriores aplica la indicación. La preferencia queda condicionada a disponibilidad; no se vende una porción adicional ni se promete gratuidad. No se confirma el pedido mientras su alcance esté pendiente.

Usa el clasificador de acompañamientos del catálogo y los resolutores existentes. No incorpora nombres/IDs/precios PPP en runtime. Ámbito deliberado: carrito vacío, estado de compra, sin otra selección pendiente, al menos dos productos anteriores distintos y opciones con defaults completos. Condiciones obligatorias, consultas y reparto explícito complejo se dejan a sus rutas actuales; no se acreditan corregidos.

Repetir exactamente la compra mientras se aclara la preferencia vuelve a preguntar sin duplicar ni aplicar la nota a ambos platos. Cancelar la indicación conserva la compra. El origen normalizado es opcional en la sesión, compatible con pendientes anteriores.

## Pruebas y evidencia

- 24 casos nuevos en `whatsapp-conditional-preference-purchase.spec.ts`: 18 recorridos de tres menús × tres formas de disponibilidad × agente simulado off/on, dos cancelaciones y cuatro límites directos del manejador.
- Los 18 recorridos verifican carrito, respuesta, estado, repetición, bloqueo de confirmación prematura, selección de un plato y DTO simulado de cuatro unidades. Los cuatro límites son pruebas del método, no del router completo.
- Baseline inicial seis fallos. Foco ampliado45/45 antes del caso de repetición. El nuevo paso de repetición encontró18 fallos: aplicaba la preferencia a todos los candidatos; mover la protección al consumidor del pendiente corrigió24/24 en22,699s (`/tmp/ppp-194-repeat-final.json`). No sumar las repeticiones de desarrollo como pruebas nuevas.
- Diagnósticos anteriores191/192: ahora12/20 pasan,8fallan,33,671s (`/tmp/ppp-194-open.json`); mejora seis casos simples, siguen los seis de reparto complejo y los dos replays largos. No se retiraron diagnósticos rojos.
- TypeScript general y build sin errores; scripts Node92/92. Dependencias externas simuladas, cero inferencia pagada/Meta/órdenes externas. No acredita precisión del modelo real.
- Global aprobada: 18.569 pruebas / 261 suites, 564 hashes, 696,38 s. Inventario exacto y fuente congelada; `/tmp/ppp-194-global-summary.json`. Publicación en staging; sin despliegue ni cambios en Main.

## Próximo trabajo

Priorizar las negaciones múltiples que añaden productos y las cantidades derivadas de marcas numéricas detectadas en los nuevos chats. Ver auditoría separada para orden de trabajo, límites y ocho diagnósticos rojos. Aún faltan conversaciones completas con recuperación después de compra parcial y acompañamientos repartidos. No declarar piloto listo por el número de pruebas.
