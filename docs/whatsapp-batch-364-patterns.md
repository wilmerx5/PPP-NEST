# Tanda364 — repetir una cotización sin carrito

Continuidad de363 y chats previos con «Dime?»/«No entendí». Casos derivados, no nuevos chats reales. El manejador de repetir contexto exigía carrito no vacío, aunque cotizar no debe agregar productos. Se priorizó este hueco antes del cálculo por cantidades múltiples.

Baseline60/64 fallan en claridad;4 ya pasaban. Ahora el manejador admite una oferta pendiente con carrito vacío, muestra los nombres cotizados (o referencia explícita a los demás productos para ofertas antiguas sin snapshot), aclara que aún no se agregaron y retoma sí/no. No modifica sesión ni confirma orden. Cotización individual conserva cantidad explícita. Mantiene guardas de estados cerrados/humanos y comportamiento previo con carrito.

76 regresiones:64 recorridos en dos catálogos × agente off/mock × oferta individual/múltiple × cuatro reformulaciones × aceptar/rechazar,32 cierres DTO simulados;4 cantidad individual2;8 guardas de estados cerrados/humanos. Foco240/3 y final76/1 aprobados. Códigoa11dc5c2.

Global34486/432 aprobada;650 fuentes congeladas e inventario exacto. TypeScript general/build y scripts aprobados. Staging364 desplegado/verificado: `b151e57c`, healthy, cero reinicios, API local/pública ok y modelos/configuración preservados. Workflow41569950036; evidencia364-staging-deployment. Controles compilados existentes aprobados; cobertura364 local. Producción349 y Kamppo321 sin cambios. Sin inferencia pagada, Meta ni órdenes externas; presupuesto267/256/11 intacto. No acredita modelo/canal real.

Próximo prioritario: cantidades distintas por producto en cotización múltiple, tanto total mostrado como carrito/DTO al aceptar y al recotizar. Revisión estática: formatMultiProductPriceReply suma precios unitarios; requiere reproducir consultas con cantidades antes de modificar cálculo. Esta tanda no cambia ese cálculo ni acredita cantidades múltiples.
