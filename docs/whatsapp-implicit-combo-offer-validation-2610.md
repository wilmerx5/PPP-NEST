# Tanda 209 — ofrecer un combo del mismo plato

Base `bc36dde8`, staging, 26/10/2026. El usuario solicita terminar esta tanda e integrar/desplegar en Main. Pruebas locales gratuitas, sin OpenAI, Meta ni órdenes externas.

## Problema y solución

Los doce casos pendientes de 205 solicitaban un plato compuesto por su nombre completo, preparación, bebida y nota. El bot separaba el componente del arroz o añadía el plato sin ofrecer la versión con bebida. La última reproducción 208 conservaba 18/30 correctos.

La nueva ruta resuelve primero la identidad completa del catálogo. Con carrito vacío, compra explícita y una única versión de combo del mismo plato que incluye bebida, agrega el plato base solicitado y propone reemplazarlo. No compra el combo ni una bebida separada antes de aceptar. Guarda las opciones explícitas para ese candidato; al aceptar revalida catálogo/precio y conserva cantidad y nota. Una bebida posterior del cliente prevalece sobre la primera. Usa la ruta existente de reemplazo sobre una línea real del carrito, no un original inventado.

El cambio es general por título, descripción, atributos y disponibilidad del catálogo. No contiene nombres, IDs o precios de PPP. Un volumen explícito solo admite una oferta si coincide con el descrito. La ruta evita pedidos separados, selecciones pendientes, consultas, correcciones y datos de entrega/contacto: esos mensajes conservan sus rutas existentes.

## Evidencia

Primer ajuste:24/30; las seis cantidades de dos unidades se reducían a una al extraer la cantidad de un prefijo sin sustantivo. Corregido pasando el prefijo con «platos» al extractor existente. No se modificó el oráculo.

Diagnóstico promovido de `whatsapp-implicit-combo-offer.repro.ts` a `whatsapp-implicit-combo-offer.spec.ts`, sin copia duplicada. **54 casos**, tres menús (arroz/medio pollo, bowl/tofu, pasta/champiñones), agente mock activo/inactivo:

- 12 ofertas iniciales, cantidades uno/dos, aceptación y DTO.
- 6 combos explícitos, con DTO.
- 6 bebidas expresamente aparte: productos y cantidades del carrito.
- 6 combos inicialmente no disponibles: no comprados ni ofrecidos.
- 6 negativas: plato base conservado y DTO.
- 6 cambios de bebida: prevalece Agua sobre la opción inicial, con DTO.
- 6 precios cambiados: recotización sin mutar el carrito, aceptación nueva y DTO.
- 6 agotados después de ofrecerlos: aviso y conservación del carrito.

36 cierres DTO simulados: identidad, unidades, preparación, nota y bebida cuando corresponde. No se acredita aquí cada campo monetario del DTO. Foco final837/837 másFalafel1/1; TS general/build yNode92/92. Primera matriz ampliada54/54 (`/tmp/ppp-209-expanded.json`), foco con cierres ampliados `/tmp/ppp-209-focus.json`. Global final18.944/274suites,580hashes,707,75s: inventario exacto y fuente sin cambios (`/tmp/ppp-209-final-global-summary.json`).

## Límites y siguiente bloque

- Alcance nuevo: nombre completo, carrito vacío y una única variante exacta compatible. Nombres abreviados, combos con títulos diferentes, varias presentaciones compatibles y compras añadidas a un carrito existente siguen en rutas previas; no declararlos resueltos por estos 54 casos.
- El rechazo probado es «no gracias» y conserva el plato; «no, la bebida aparte» en un solo turno requiere una tanda específica. El pedido explícito de bebida aparte desde el inicio sí tiene controles.
- Con menú cambiado, opciones retiradas, consultas durante la propuesta y notas repartidas por unidades deben ampliarse las continuaciones; no sustituir estas pruebas por conteos.
- No acredita modelos reales ni WhatsApp real. Mantener validación piloto supervisada y medición de costo por orden/modalidad. Se despliega también la telemetría199 y la eliminación de reintento cosmético203 al promover los commits acumulados; el ahorro real aún debe medirse.

## Promoción

Global aprobada; promoción y despliegue en curso. El cierre productivo se registrará después de verificar el contenedor. Producción inspeccionada: `/var/www/ppp-nest`, ramaMain, HEAD0f8c98da, contenedorppp_nest_api. Compose privado y.env se preservarán por hash; imagen anterior tendrá etiqueta de rollback. Main local contiene472artefactos generados que no se sobrescribirán (`/tmp/ppp-209-main-local-preserved.json`). La promoción no cambia dist versionado ni tsconfig.build.tsbuildinfo.
