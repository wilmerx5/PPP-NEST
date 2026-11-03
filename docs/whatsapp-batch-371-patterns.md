# Tanda371: conservar y corregir el reparto de cuatro platos

Origen: chat01/11 mensajes438–447. Entrada original multilínea ya cubierta por340. Se prueba su continuación: «Sin ensaladas», «solo quería4ejecutivos», «solo eran3fritos y uno rboaster» y cancelación. Código `d16ba238fdc4960d4c8110c4642cab7768edc5ba`.

## Fallos y cambios

- Con4ejecutivos ya repartidos, repetir el total abría una selección para poner4en una sola línea. Un total agregado que ya coincide se reconoce sin alterar opciones.
- La reiteración de3fritos/1broaster podía eliminar el broaster. Se reconoce el reparto entre preparaciones ya presentes de la misma familia; corrige cantidades solo si cada cambio señala una línea única. Conserva notas, atributos, productos adicionales y el paso de checkout. Una transposición adyacente en palabras largas se resuelve únicamente contra el vocabulario del carrito si es única (rboaster→broaster); no modifica el buscador general.
- «Cancelo»/«cancela el pedido» quedaban atrapados en la aclaración de sopa. Se delegan en la cancelación general y el reparto pendiente cuenta como pedido no enviado, aunque el carrito esté vacío y exista una orden anterior. «Cancelo con50000» conserva el reparto.

## Evidencia

Baseline inicial2/4 fallan; matriz final42/48 fallan y6controles ya pasan. Los fallos incluyen respuesta/estado/carrito; no equivalen a42corrupciones independientes.48 pruebas:4recorridos desde la entrada original;32 escenarios de carrito preparado en dos familias (ejecutivos/pescado), agente off/mock, compra/revisión final, reparto correcto/cantidad7a3/múltiples líneas/familia equivocada;12 controles de cancelación/pago con y sin orden previa.20 cierres DTO simulados comprueban cantidades y conservación de notas/bebida. Foco543/4 aprobado. Global: 34.852 pruebas / 439 suites aprobadas; 657 fuentes congeladas e inventario exacto. TypeScript general/build y scripts aprobados. Despliegue staging pendiente.

## Límites y próximos pasos

No se reprodujo de nuevo la inflación histórica original; la cantidad7del carrito preparado es un fixture de recuperación. El fallo original con un pollo completo ajeno al ejecutivo se protege con aclaración de familia, no con sustitución automática. Siguen pendientes entrada en una sola línea, redistribución entre varias líneas con distintas sopas/notas, y órdenes de varias familias que exigen precisar el destino. Próximo: completar esa aclaración de cantidades por línea y comprobar conservación de sopas/bebidas hasta cierre; después notas de cocina en varios productos de los chats202–216/368–385. Duplicaciones sin reproducción requieren trazas.

Cero inferencia pagada, Meta u órdenes externas; presupuesto267/256/11 intacto. Producción349/Kamppo321 sin cambios. No acredita modelo/canal real ni cierre de todo el corpus.

## Diseño de la siguiente tanda (pendiente de ejecutar)

1. Partir de dos líneas del mismo ejecutivo con sopa o nota distinta y otra preparación; solicitar un total menor para ese ejecutivo. La aclaración debe enumerar las líneas y conservar el carrito.
2. Responder por número, sopa o nota; comprobar que la cantidad no se aplique por error como opción de otra lista abierta. Si sigue siendo ambiguo, no mutar.
3. Probar una reformulación completa con cantidades por línea, tanto en compra como en revisión final; comprobar conservación de bebida, notas y producto aparte hasta el DTO de cierre.
4. Interrumpir con consulta de total, cancelar la corrección y cambiar el carrito antes de responder; impedir que una selección obsoleta afecte otro producto.
5. Ejecutar primero los casos literales pendientes del corpus («3 fritos y uno broaster, cuatro ejecutivos en total» y «todos pierna pernil, 3 ajiacos y una menudencia»), contrastar con baseline y ampliar solo los comportamientos que fallen.

Estos puntos son diseño, no pruebas aprobadas ni cobertura atribuida a la tanda371.
