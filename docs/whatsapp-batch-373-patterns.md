# Tanda373: repartir cantidades sin perder las opciones

Código `390b64ec7549d98aadd534ad178a721fdf802c04`. Derivada del chat01/11 mensajes438–447 y el pendiente371/372. Los escenarios usan carritos preparados; no reproducen el origen histórico de la inflación.

## Problema y comportamiento

Con frito/ajiaco ×4, frito/menudencias ×3 y broaster ×2, «solo eran3fritos y uno rboaster» pedía aclaración genérica sin guardar el reparto. Ahora conserva los totales solicitados, muestra las líneas y acepta «dos con ajiaco y uno con menudencias». Aplica2+1+1 en una única actualización, conservando opciones, notas y postre independiente. Si varias preparaciones tienen varias líneas, exige resolverlas todas.

No interpreta un número suelto como cantidad de una línea ni aplica parcialmente una suma discordante, referencia desconocida o repetida. Consultar el total conserva el reparto. Cancelar solo el cambio conserva el carrito; cancelar pedido lo vacía. Cambio de carrito o10min de antigüedad descartan la aclaración sin mutar productos.

La ampliación detectó que normalizar antes de separar comas perdía el separador. También12 casos intermedios fallaron al repetir una respuesta: podía agregar la frase como nota del postre o salir de confirmación. Una constancia de la respuesta aplicada, vinculada al carrito y a10min, evita repetir esa mutación; si cambió/venció, pide instrucción completa sin tocar el carrito.

## Evidencia

Baseline inicial4/4 fallan en la claridad de la pregunta.76 regresiones:24 recorridos (dos catálogos × agente off/mock × compra/revisión × palabras/comas/notas exactas),40 controles (suma discordante, línea repetida, desconocida, número suelto, pregunta, cancelar cambio, cancelar pedido, carrito cambiado, vencimiento y total),4 repartos de dos preparaciones ambiguas,8 repeticiones tras cambio/vencimiento.52 cierres DTO simulados verifican cantidades; los recorridos principales comprueban notas/bebidas y producto aparte. Foco349/5 aprobado. Global final: 34996 pruebas / 441 suites aprobadas; 659 fuentes congeladas e inventario exacto. TypeScript general/build y scripts aprobados. Staging373 desplegado/verificado: `658ea3c3`, healthy, cero reinicios, API local/pública ok y modelos/configuración preservados. Workflow41656152898; evidencia373-staging-deployment. Controles compilados existentes aprobados; cobertura373 local.

## Límites y siguientes pasos

Las cantidades por línea son positivas, de1a30; se debe identificar cada línea ambigua una vez en una respuesta completa y las sumas deben coincidir. Cero/eliminación, cambios de total durante la aclaración y reparto fragmentado en varios mensajes quedan pendientes. La repetición protegida es la misma respuesta normalizada, no cualquier paráfrasis. La entrada literal compacta del chat, inflación histórica y familia errónea no se declaran resueltas. Próximo: encabezados/repartos en una frase, luego notas multiproducto202–216/368–385.

Cero inferencia pagada, Meta u órdenes externas; presupuesto267/256/11 intacto. Producción349/Kamppo321 sin cambios. Modelo/canal/persistencia simulados.
