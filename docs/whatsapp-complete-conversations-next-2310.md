# Próximo bloque: conversaciones completas, no solo carritos preparados

Preparado durante global132. Estos son casos de desarrollo, no una muestra reservada independiente. No ejecutar ni modificar src hasta que termine el runner132 y se verifique su inventario/hash. No llamar a servicios externos.

## Alcance

Tres catálogos sintéticos: cafetería (bebida con base/sabor), pizzería (masa y acompañamiento), cocina de bowls (base y salsa). Evitar que todos los fixtures compartan exactamente la misma estructura: incluir producto sin atributos, uno con dos atributos y acompañamiento vendible por separado. Usar on/off del agente simulado; no atribuir esos resultados al modelo real.

Empezar con carrito vacío, construir por mensajes del usuario y terminar con DTO de orden simulada cuando corresponda. No rellenar el carrito final a mano. Configurar únicamente identidad/sistemas externos necesarios. Elegir un bloque pequeño y coherente, ejecutar focal, corregir causa general si aparece un fallo, luego controles compartidos. No multiplicar paráfrasis antes de comprobar un caso representativo.

## Familias y oráculos

1. Compra de dos unidades, una con opción A y otra B; notas diferentes. Total dos, cada nota pertenece a una unidad. Repetir con variante que usa un atributo diferente, no solo cambiar el nombre del plato.
2. Producto con bebida incluida y porción adicional explícita: conservar extra, no vender otra bebida por interpretar el atributo como producto.
3. Después del reparto, consulta de precio: responder importe real y no cambiar cantidades, atributos o notas.
4. En solicitud de nombre, consulta de ingredientes: responder desde catálogo y seguir pidiendo nombre. Nunca guardar la pregunta como identidad.
5. Dirección y detalle interior en un mensaje: separar destino geocodificable de torre/apto; conservar ambos en DTO. Geocoder simulado y aserción sobre consulta enviada, no precisión real de mapas.
6. En solicitud de pago, cambio de teléfono: guardar y confirmar contacto nuevo; retomar el mismo paso, sin mensaje vacío ni orden prematura.
7. En solicitud de pago, cambiar solo una unidad de las dos: no afectar otra línea; el total de unidades sigue siendo dos.
8. Consulta del total después de cambiar una unidad: respuesta y carrito deben concordar con DTO posterior.
9. Cierre con «así está bien» antes de tener datos: avanzar solo al dato necesario, no crear orden ni volver sin motivo a «algo más».
10. Confirmación final: un solo efecto de creación y DTO exacto. Saludo/cortesía posterior no duplica ni reabre el pedido.
11. Cancelación del borrador con explicación («ya lo pedí por teléfono»): limpiar borrador, no buscar un producto llamado así ni cancelar orden externa.
12. Producto desconocido durante checkout: responder indisponibilidad/alternativas reales, conservar carrito y permitir volver al paso pendiente.

## Evidencia mínima

Por turno: respuesta pertinente y sin afirmaciones de acciones no aplicadas; carrito antes/después; estado y selección pendiente. Al final: producto, cantidad expandida, precio, opciones y notas por unidad, datos de contacto y destino. Aserción de cero órdenes antes de confirmar y exactamente una tras confirmar. No usar solo snapshots de texto ni solo conteos.

La global132 actual puede tardar bajo carga: no lanzar otra global ni editar fuente mientras siga activa. Si pasan los controles y solo se añaden tests, ejecutar el bloque y suites cercanas más TypeScript; no repetir global sin cambio compartido/riesgo nuevo. Si hay cambio en reglas compartidas, requiere global con fuente congelada. Registrar timeouts como tales, nunca como aprobados.

## Después del bloque

Comparar resultados con casos reservados completos no utilizados para desarrollar. El piloto supervisado sigue requiriendo evidencia del modelo/canal real, costos/latencia y ausencia de fallos críticos conocidos; los mocks no acreditan reconocimiento de audio o imagen. No desplegar Main automáticamente.
