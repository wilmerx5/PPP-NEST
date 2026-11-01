# Tanda331 — reparto después de elegir familia

El chat31/10, mensajes396–401, pide dos pollos y luego uno frito y uno broaster. La ruta rechazaba todo producto con atributos aunque tuviera opciones predeterminadas, pedía elegir otra vez un número y retenía la cantidad dos.4/4 controles iniciales fallaron.

Se permite completar el reparto explícito cuando coincide con la cantidad pendiente, los productos pertenecen a la misma familia de preparación y no faltan opciones. Las listas de productos diferentes, sabores pendientes, reemplazos y acompañamientos solicitados conservan sus protecciones: no se generaliza la selección automática a todas las opciones.

La ampliación encontró además una dirección falsa en «Para pedir dos pescados» y una compra adicional al reafirmar exactamente las dos preparaciones existentes. El texto de intención de compra no es destino; la reafirmación exacta de las dos líneas de una unidad conserva el carrito y retoma el paso.

16 controles nuevos:2 catálogos × agente off/mock × normal/precio/agotado/reafirmación.12 recorridos completos hasta DTO/recibo y4 controles de producto retirado sin mutación. Foco118/3 aprobado. La primera ampliación detectó que permitir defaults en cualquier lista elegía sabores silenciosamente; se restringió a la familia de preparación y la suite several-list-rows volvió a aprobar. Primera global interrumpida por cuatro comprobaciones de redacción heredadas de330: esperaban una pregunta explícita aunque carrito y pendientes eran correctos. El encabezado ahora pregunta «¿Cuál prefieres para …?», manteniendo una única lista. Global final aprobada: 32767 pruebas/398 suites, inventario exacto y 615 fuentes congeladas; TypeScript general/build y scripts aprobados.

Pendiente del grupoD: reparación cuando ya hay cantidades equivocadas, «ambos en combo» y sustitución de pollo+bebida por combo conservando opciones. No declarar resueltos esos recorridos por corregir el origen del reparto. Cero inferencia pagada, Meta y órdenes externas. Solo staging; producción/Kamppo sin cambios.

Publicación y despliegue staging pendientes; no acreditar deploy hasta verificar SHA y salud.
