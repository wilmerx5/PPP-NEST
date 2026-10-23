# Tanda 113 — opción y bebida en un turno

Base 1e7a6fdc, staging. 60 regresiones nuevas, tres catálogos y agente simulado on/off: «el combo 2 con Uva porfa», «la opción 2 con Pepsi», «quiero el número 1 con Uva», «la opción 2 con bebida Uva»; dos unidades con nota, atributos compatibles y 24 DTO simulados. Contrastes: número no ofrecido, bebida desconocida, dos sabores, producto retirado/agotado y cambio de precio. Baseline 30 fallidos/114 aprobados (primera extensión); final 168/168 en la suite ampliada. Foco 389/389 en cinco suites; TypeScript general/build OK y Node 92/92. Global 80 + 16.021 = 16.101, 192 suites, inventario exacto y 490 hashes intactos; 628,1 s, sin reintentos.

Se resuelve primero la referencia a la fila ofrecida y después la bebida exacta de ese producto, sin inferir el combo preferido a partir del sabor. La lista existente valida disponibilidad/precio para esa fila. Una bebida desconocida o ambigua conserva carrito y pide repetir opción/bebida; no elige por defecto ni agrega bebida aparte. Los productos retirados o agotados no se reemplazan silenciosamente por el preferido. Reglas por catálogo, sin excepciones PPP.

Límites: oferta de reemplazo por combo con preferredId; nombre de bebida exacto tras normalización y cortesía. No acredita selección + cantidad explícita («dos del combo 2 con Uva»), nombre/teléfono/dirección en la misma frase, ni distribución de sabores. Modelos, transporte y servicios externos simulados; cero API pagada/WhatsApp/órdenes externas. Publicado en la rama staging, sin despliegue de esta tanda: servidor staging conserva 3e87cdac (hasta 112), Main conserva hasta 109. Agrupar el próximo despliegue validado. Evidencia: [tanda 113](whatsapp-inline-combo-drink-validation-2210.md).

Siguiente: selección + cantidad explícita y opciones, contrastando número de fila/código/cantidad; después contacto y dirección durante selección. Mantener consultas, agotados, precio cambiado y DTO como controles.

## Hallazgo y corrección

El lector anterior esperaba una fila sin sufijo. «El combo 2 con Uva» no reconocía el número y la coincidencia de Uva activaba el combo preferido, aunque el cliente hubiera indicado otro. Ahora la referencia antes de «con» determina la fila. Su sufijo debe resolver una bebida del producto elegido; la coincidencia es exacta normalizada, no un fragmento que ignore un segundo sabor o instrucciones extra. Se mantienen cantidades y notas de la línea reemplazada.

Si el producto cambia de precio o disponibilidad se delega la fila a tryResolvePendingMatchPick, que ya controla esos casos; la bebida no se convierte en selector de otro producto. La nueva cotización exige volver a elegir antes de aplicar. Si no hay una única bebida válida, se conserva el pedido y se pide repetir opción/bebida; el siguiente mensaje completo sí puede resolver.

## Pruebas y evidencia

- Foco: whatsapp-related-combo-offer.spec.ts, whatsapp-combo-requote-contact.spec.ts, whatsapp-combo-price-acceptance.spec.ts, whatsapp-combo-live-menu.spec.ts, whatsapp-cart-line-drink-combo.spec.ts, con Jest --maxWorkers=4 --silent: 389 aprobadas.
- npx tsc --noEmit y npx tsc --noEmit -p tsconfig.build.json: OK; node --test scripts/*.test.cjs: 92 aprobados.
- Global: ráfagas originales en serie, luego resto con cuatro workers. Ambas fases separadas, inventario completo sin duplicados y fuente congelada. No inferencia real ni cambio de modelos.
- Evidencia local auxiliar: /tmp/ppp-113-baseline.json, /tmp/ppp-113-focus.json, /tmp/ppp-113-targets.json, /tmp/ppp-113-burst.json, /tmp/ppp-113-rest.json, /tmp/ppp-113-global-summary.json.
- Oráculos: producto/filas/cantidad, nota previa, atributos compatibles, bebida, respuesta, ausencia de selección pendiente cuando se resuelve, no creación de orden antes de confirmar, DTO con dos unidades exactas y bebida de ambas. El harness simula reply y servicios externos; no acredita canal Meta ni reconocimiento del modelo real.

Esta tanda no se ha desplegado. Mantener staging como integración y preservar Main. No declarar piloto listo por estos conteos.
