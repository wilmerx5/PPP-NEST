# Tanda365: cantidades por producto al cotizar

## Evidencia y corrección

Derivada del seguimiento364 y de los chats donde consultar/agregar o corregir cantidades debe conservar la intención. No es un nuevo chat real ni una prueba del modelo real.

La reproducción inicial con router completo falló en48/64 casos: la cotización sumaba una unidad de cada plato aunque se consultaran cantidades distintas.16 controles de una unidad por producto ya pasaban. Tras corregir la presentación, los64 recorridos conservaron las cantidades en carrito y cerraron una orden simulada con el número esperado de unidades.

La oferta ahora guarda cantidad por SKU junto con nombre/precio. El texto muestra cantidad y subtotal cuando hay varias unidades, y el estimado suma esos subtotales. Si cambia un precio antes de aceptar, recalcula con las cantidades guardadas y exige otra aceptación. Los controles adicionales detectaron dos fallos de aceptación de «Pack 6 Empanadas»: se añadían seis paquetes. El reconocimiento de contenidos del SKU admite ahora prefijos pack/paquete/combo/promoción además del número inicial.

## Cobertura

76 controles nuevos:64 recorridos en dos catálogos × agente desactivado/simulado × cuatro repartos (2/3,3/2,1/4,1/1) × dígitos/palabras × precio intacto/cambiado. Incluyen interrupción con menú, aceptación, carrito y64 cierres DTO simulados.12 controles de cantidad implícita y nombres «6 Empanadas»/«Pack 6 Empanadas», con aceptación/rechazo. Foco final220/3 aprobado.

La primera ampliación tuvo214 aprobados y2 fallos de paquetes; se corrigieron y se amplió la cobertura. No se oculta esa ejecución como aprobada. La validación completa conserva hashes del código y comprueba inventario exacto.

## Límites y siguiente tanda

Precios base, dos SKUs distintos sin opciones obligatorias. No acredita modelos reales, WhatsApp real ni órdenes externas. No se modificó el reparto general de cantidades de pedidos ordinarios. La protección de paquetes se comparte con esas rutas y requiere global completa. Próximo: cotizaciones múltiples con opciones obligatorias y notas diferentes por plato, conservando cantidades hasta resolver todas las opciones; revisar también ofertas antiguas sin cantidad guardada y consultas largas.

Estado: global34562/433 aprobada, sin fallos ni omitidas;651 fuentes congeladas e inventario exacto. TypeScript general/build y scripts aprobados; despliegue365 pendiente. Producción349 y motor Kamppo321 sin cambios. Cero inferencia pagada/Meta/órdenes externas; presupuesto267/256/11 intacto.
