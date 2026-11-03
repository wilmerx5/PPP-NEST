# Tanda369: reparación completa de combos

Origen: chat01/11, mensajes400–437. Se priorizó un recorrido completo, no variantes masivas de frases aisladas. Código `304b9341742e03a4873fe522721ac41e5c5f612b`.

## Fallos reproducidos

- Baseline:16/16 recorridos fallan primero en «el combo ... lo quiero con gaseosa Ginger»: la ruta de preparación impide actualizar la opción incluida.
- Tras resolver ese primer paso, «quita el combo que va con Colombiana» no selecciona la línea; con agente simulado puede contestar ingredientes en lugar de quitarla.
- Un control adicional detecta que pedir quitar una combinación ausente puede acabar quitando otro combo por búsqueda aproximada.

## Corrección y evidencia

La referencia definida resuelve la opción contra el producto nombrado y conserva estado/notas/otras compras. La retirada normaliza «que va con» para el selector existente y frena el fallback si una opción de catálogo explícita no está en el carrito. No incorpora IDs, nombres ni precios de PPP al código.

26 pruebas nuevas:16 recorridos completos en dos catálogos, agente off/mock y edición antes/después de revisión final, con dos frases de retirada;10 controles de cantidad, dos líneas equivalentes, pago pendiente, opción ausente y retirada sin coincidencia. Los16 recorridos comprueban el DTO final: reemplazo, bebida Ginger, nota sin cebolla, gaseosa Colombiana aparte y acompañamiento. Foco170/5 aprobado. Global34764/437 aprobada,655 fuentes congeladas e inventario exacto; TypeScript general/build y scripts aprobados. Staging369 desplegado/verificado: `0f1ee73c`, healthy, cero reinicios, API local/pública ok y modelos/configuración preservados. Workflow41585064291; evidencia369-staging-deployment. Controles compilados existentes aprobados; cobertura369 local.

## Límites y siguiente prioridad

No prueba modelo/canal/DB reales ni todas las formas abreviadas. Ledger01/11 actualiza únicamente los casos01/02 de esta familia; «cambia solo el que tiene Colombiana...» y «agrega otro combo con Ginger» mantienen su seguimiento pendiente. Próximo: conservar bebida al resolver opciones de varios productos (combo + medio pollo), seguido por reparación de cantidades repartidas. Duplicaciones históricas sin reproducción requieren trazas. Producción349/Kamppo321 sin cambios. Cero llamadas pagadas, Meta u órdenes externas; presupuesto267/256/11 intacto.
