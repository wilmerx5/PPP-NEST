# Relaciones de combos en producción

Backend desplegado el 12/11/2026 con aaca0c43. Se promueve únicamente la mejora de relaciones desde Main498 y sus dependencias de selección de presentación. Las demás tandas de staging conservan su ciclo de promoción.

Los SKU existentes quedan vinculados en producción mediante la FK comercial.

- 1 Pollo Broaster → Combo De Pollo Broaster, 4 → 98.
- 1 Pollo Frito → Combo De Pollo Frito, 1 → 99.
- Arroz Paisa → Combo De Arroz Paisa, 35 → 94.
- Arroz Chino Con Medio Pollo → Combo Arroz Chino Con Medio Pollo, 36 → 97.
- Arroz Chino Con Costillas De Cerdo → Combo Arroz Chino Con Costillas De Cerdo, 84 → 85.

Se usa el producto, precio, atributos e inventario de cada SKU. La configuración se guardó en una transacción sobre los cinco vínculos. La creación de productos fue cero. Se guardó una copia privada de la configuración previa. La API pública acredita las relaciones y los valores de nombres, códigos, precios y opciones. El usuario publicará el panel desde main9c995fd. El checkout limpio ppp-admin-production-combos tiene .env.production local con las URL públicas y build aprobado.

## Pruebas

La global de faffb554 pasa con47.922 pruebas y559 suites. Hay11 pruebas omitidas en dos suites Bold DB, que requieren su configuración de integración separada. Los controles de temporizadores forman parte de ese total y se ejecutaron por separado.

Un contraste adicional de ocho compras/cambios sobre el catálogo real detectó dos compras directas de combos que pasaban a preguntar opciones. La guardia de compra directa se extiende a los combos vinculados para reutilizar el flujo habitual. Cuatro nuevas regresiones comprueban broaster/frito, carrito vacío/comida previa, opciones por defecto, respuesta y cierre único. Sobre el ajuste final pasan46 focalizadas de producto/combo y470 relacionadas en11 suites. Las fuentes permanecen congeladas durante esa ejecución. La global completa corresponde al commit anterior a este último ajuste acotado.

Los ocho resultados comparados con Main498 coinciden semánticamente, excluyendo la nueva metadata de relación. Esa comparación conserva también fallos previos de la ruta sin IA. «Cambia el pollo a frito/broaster» puede añadir otra línea en ambas versiones. La petición inicial de arroz chino con medio pollo abre la selección existente. Se registran para una tanda posterior y requieren más cobertura con el agente activo.

Diez recorridos con el catálogo leído después del despliegue prueban ambas direcciones de las cinco parejas, cantidades, opciones, notas, precio y DTO de cierre. Las órdenes se simulan. TypeScript general y build Docker pasan. La imagen candidata y la imagen activa superan744 controles compilados de router, además del smoke histórico y la comprobación de identidad de la familia. La API pública y local responden saludables, con DB conectada. Las pruebas realizaron cero inferencias pagadas y cero órdenes externas.

Ver product-combo-production-validation.json para versiones y evidencia. La guardia se publicó también en staging5414d79e. El runtime de staging conserva el despliegue anterior. Antes de integrar la rama de relaciones de Kamppo se debe portar esta guardia de compra directa y sus cuatro regresiones.
