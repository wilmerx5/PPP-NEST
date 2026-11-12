# Relaciones comerciales entre productos y combos

## Configuración

Cada combo conserva su SKU, precio, disponibilidad e inventario. `comboBaseProductId` apunta al SKU normal mediante una clave foránea. Varios combos pueden compartir un producto normal. La relación se configura desde la edición del producto en el administrador y se guarda al seleccionar. Para crear una relación, primero se crean ambos productos y después se edita el combo.

`PATCH /api/products/:id/combo-relation` requiere administrador y recibe `{ "comboBaseProductId": 123 }` o `{ "comboBaseProductId": null }` para desvincular. Omitir el campo, usar un ID inexistente, autorreferenciarse o vincular a otro combo se rechaza. Un producto que sirve de base de otros combos debe desvincular sus hijos antes de convertirse a su vez en combo. La actualización bloquea los extremos en orden de ID dentro de una transacción. La FK impide eliminar una base referenciada.

Los vínculos comerciales son independientes de las relaciones de consumo de inventario. Configurar un vínculo comercial no cambia el stock ni las órdenes históricas.

## Motor de pedidos

El catálogo transporta el campo nullable hasta el motor. El vínculo configurado identifica la familia incluso si los nombres son diferentes. Los productos con nombres parecidos que carecen del vínculo quedan fuera de esa familia. Las solicitudes de conversión vuelven a cargar el catálogo.

Una conversión conserva la cantidad y las opciones compatibles, retira las exclusivas del producto anterior y usa el precio del SKU de destino. Las opciones adicionales pendientes mantienen el carrito original hasta completar la elección. Si hay varios combos elegibles se pregunta cuál. Si la presentación vinculada está ausente o fuera de horario, se conserva el carrito y se explica la imposibilidad.

Los catálogos actuales procedentes de base de datos exponen `comboBaseProductId`, incluso cuando vale `null`. Una conversión desde un producto sin relación configurada se detiene con una explicación. Los adaptadores históricos que todavía omiten el campo conservan el contrato anterior durante su actualización. Para activar la semántica de relaciones explícitas, los adaptadores deben transmitir siempre el campo nullable.

## Adaptación a Kamppo

El motor usa IDs del catálogo recibido y carece de excepciones por restaurante, nombre o precio. El adaptador de Kamppo debe incluir el mismo campo nullable y cargar únicamente los productos del restaurante actual. Su API administrativa y su restricción de integridad deben comprobar que ambos extremos pertenecen al mismo restaurante, usando una FK compuesta por restaurante/producto si comparten tabla entre comercios. Debe preservar los IDs y las órdenes existentes. Esta tanda no despliega Kamppo.

## Validación

Las regresiones nuevas incluyen cambios en ambos sentidos, ida y vuelta, cantidades, conservación de opciones/notas, selección pendiente, totales y cierre único del pedido, nombres sin semejanza, un homónimo comercial ajeno, destinos no disponibles o ausentes, varios combos, compra inicial y un segundo catálogo sintético. También validan persistencia transaccional y el contrato del DTO. Las pruebas de cierre aíslan proveedores y órdenes externas. La migración se comprueba adicionalmente en MariaDB desechable.
