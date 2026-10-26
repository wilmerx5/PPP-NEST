# Tanda 213 — códigos, volúmenes y consultas de presentaciones

Base `199ad1ec`, staging. No cambia Main/producción ni despliega esta tanda.

## Contrato y correcciones

Con alternativas de combo pendientes, una referencia explícita por código debe apuntar a una fila ofrecida. Un volumen debe identificar exactamente una presentación de esa lista en la carta vigente. El identificador/volumen se convierte a fila antes de resolver la compra, para no inflar cantidad ni perder opciones por una ruta diferente. Referencias fuera de la lista o ambiguas conservan el pedido y piden aclarar. Códigos agotados conservan las alternativas y lo explican.

Consultas explícitas de precio/sabores sobre «el de [volumen]» consultan la presentación identificada sin seleccionarla. Responden y guían a elegir una fila; el carrito y las alternativas siguen intactos. Reutiliza extractores de volumen y catálogo; no incluye IDs/nombres/precios de restaurante en runtime.

## Pruebas

Nueva `whatsapp-combo-presentation-reference.spec.ts`:78 conversaciones en tres menús×agente mock off/on. Referencias #código/código con cortesía, ml, coma decimal y «litro y medio»; códigos ajenos, volúmenes inexistentes, consultas de precio/sabor; volumen duplicado o cambiado, código agotado y nueva cotización. Todas cierran DTO simulado con dos unidades del producto elegido, preparación y nota. Bebida explícita se verifica en carrito. No afirmar revisión de todo importe del DTO.

Baseline54:6 aprobados/48 fallidos (`/tmp/ppp-213-baseline.json`). Resolver referencias:42/54 (`/tmp/ppp-213-after.json`). Añadir consultas:54/54 (`/tmp/ppp-213-queries.json`). Ampliación/foco318 aprobados/6 fallidos: códigos agotados perdían lista pendiente (`/tmp/ppp-213-focus.json`). Corregida esa ruta:78/78 finales (`/tmp/ppp-213-new-final.json`). TypeScript general y build aprobados sobre la fuente final; Node92/92 y guarda Falafel1/1. Global final:19.142/19.142 pruebas en278 suites,585 hashes sin cambios e inventario exacto,708,90s (`/tmp/ppp-213-final-global-summary.json`). Fuente congelada durante ambas particiones; ninguna suite omitida o duplicada. No ocultar los fallos con oráculos más débiles.

## Límites y continuación

Selección por descripción libre («el familiar», «el grande»), referencia por nombre duplicado y consultas por código siguen pendientes. También negativa con compra aparte y datos de contacto durante la lista múltiple. Las consultas cubiertas son explícitas de precio/sabores y volumen; no todas las formulaciones ni mensajes mixtos con cambios. Siguiente bloque: esas interrupciones preservando respuesta, carrito, estado y DTO; opciones distintas entre presentaciones y cambios posteriores del catálogo.

Sin API pagada, Meta ni órdenes externas; modelos intactos. No se midió ahorro real. Publicar solo staging y agrupar despliegues. No declarar vendible por conteos.

## Próxima tanda concreta

1. Lista múltiple pendiente + «no, una bebida aparte»: conservar base y añadir solo la bebida explícita; no aceptar combo por coincidencia de sabor.
2. Nombre/teléfono/dirección durante la lista: guardar el dato válido y retomar la elección sin comprar ni perder opciones/notas.
3. Consultas por código y contenido: responder desde catálogo vigente sin convertir código en cantidad ni crear productos.
4. Candidatos con opciones distintas: revalidar la bebida solicitada para el candidato elegido; si no existe, pedir únicamente esa opción, sin sustituirla silenciosamente.

Ejecutar primero foco con router completo y dependencias simuladas. Solo tras cerrar fallos ampliar con fuente congelada a global; no lanzar global por cada variante ni editar durante la validación. Conservar escenarios fallidos como evidencia y registrar límites de inferencia simulada.
