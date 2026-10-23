# Tanda135 — compra, bebida incluida y adicionales

## VIGENTE — tanda 135: bebida del combo y adicional (23/10)

Base 17c1216e, staging. 24 conversaciones nuevas desde carrito vacío en tres cartas sintéticas (combo de pollo, menú hamburguesa, plato de pasta), agente simulado on/off, adicional con nombre del catálogo o lenguaje natural, bebida incluida sola o una bebida extra explícita. Compra + pregunta de sabores abre selección, pregunta sobre acompañamiento no pierde el plato pendiente, elección por nombre/número aplica la bebida al combo, extra alimentario se añade, consulta de total no muta y cierre llega a DTO exacto. La bebida independiente solo se cobra si se pidió aparte.

Fallos reproducidos: la regla compra+consulta de sabores solo reconocía atributos Sabor, no Bebida; la búsqueda simplificada eliminaba «combo» y perdía la coincidencia exacta; respaldo del agente no reconocía una porción adicional porque quitaba «porción» solo de la petición, no del nombre de catálogo. Correcciones generales: reconocer ambos atributos, priorizar nombre completo tras retirar únicamente cantidad y comparar simétricamente nombres de porciones/adicionales. Sin IDs/precios/nombres PPP en producción.

Foco final 92/92 en tres suites, 16,906 s; 24 casos nuevos. TypeScript general/build OK; Node 92/92. Global aprobada: 16.872/16.872, 200 suites, 498 hashes intactos, inventario exacto; 575,31 s. Evidencia /tmp/ppp-135-global-summary.json. Incluye tandas133/134/135; no sumar focos solapados. Publicación y despliegue de135 pendientes. Main/producción intactas. Staging ejecuta bd3f5e5e, última verificación remota132; no afirmar nuevo despliegue. Cero API pagada, WhatsApp u órdenes externas.

Siguiente: publicar solo staging y desplegar el candidato validado. Luego dirección ambigua/fuera de cobertura con correcciones de carrito y contacto, conservando interiores y sin afirmar dirección segura. Límites135: turnos seriales, recogida, atributos simples, agente con respuestas programadas; no acredita percepción real ni todas las paráfrasis. Un código solo no siempre inicia selector: el comportamiento predeterminado se conserva. [Detalle135](whatsapp-combo-extra-journey-validation-2310.md).

## Evidencia y baselines

- Primer montaje usaba código81 para esperar un selector: sin agente aplicaba predeterminado y con agente mock no actuaba. No es evidencia de fallo de selección: /tmp/ppp-135-code-start.log. Se cambió a petición explícita de compra+pregunta de sabores.
- Baseline funcional6/6 fallos: /tmp/ppp-135-beverage-baseline.log. Al reconocer Bebida quedaban dos fallos de Combo por búsqueda simplificada. Se prioriza nombre literal después de retirar cantidad.
- Un fallo posterior en extra con agente simulado: /tmp/ppp-135-extra-wording.log. El contraste natural también falló; se corrigió comparación simétrica de porción/adicional y se conservaron ambas formas en la matriz final. No se escondió el caso cambiando solo su frase.
- Foco final /tmp/ppp-135-final-focus.log:92/92,24 nuevas. /tmp/ppp-135-tsc.log; /tmp/ppp-135-node.log:92/92. Suite nueva whatsapp-combo-extra-full-close.spec.ts.
- Global aprobada; despliegue aún pendiente de verificación de salud. Timeout del runner15s; no cambia límites del bot. Fuente congelada durante global, modelos/Meta/persistencia simulados.
