# Plan de cierre para piloto supervisado — 20/10/2026

## Punto de partida verificado

Staging permanente: base f2187263, tanda 57 cerrada, 12850 tests / 141 suites; runtime acreditado antes de esta sesión: 30cffa27 (tandas 55–56). Main no se modifica. Estos números acreditan regresiones ejecutadas, no un porcentaje de comprensión o preparación comercial. Tanda 58 cerrada: 36 casos nuevos, 12886 tests / 142 suites globales verdes, 198 focalizados, TypeScript/build y 92 Node. Despliegue agrupado 57–58 acreditado: ccb6a395, healthy el 20/10 a las 21:28:00Z; producción intacta. Consultar relevo y JSON de tanda 58 para evidencia completa.

Las familias recientes cubren compras condicionales, sabores, consultas durante selección, reemplazos, nombres duplicados y catálogo cambiante, con respuesta/carrito/estado/DTO. La cobertura usa checkout sembrado y modelos/servicios simulados: no demuestra que el bot llegue a ese estado interpretando todos los mensajes anteriores.

PDF 18/10: la auditoría documenta lectura de 60 páginas e inventario de patrones. No acredita todas las conversaciones completas. No marcar un chat cerrado por parecido con otro test. Otros PDFs deben conservar su propia trazabilidad; no extrapolar esta lectura a todos los adjuntos.

## Huecos prioritarios y secuencia limitada

1. **Tanda 58: salidas de selección.** Listas vacías al ofrecer o tras retirar productos; código inválido; regresar al sabor original o cancelar solo la bebida y finalizar. Tres menús, agente simulado on/off, respuesta útil, carrito conservado y DTO único. Cerrar este bloque antes de añadir más variantes de catálogo.
2. **Tanda 59: recorridos desde saludo.** Reservar primero conversaciones no usadas al escribir reglas. Reproducir una compra básica, una compra con dirección y datos juntos, y una corrección durante pago. Variar tres menús, usar eventos de mensajes separados donde corresponda, no sembrar el estado crítico. Verificar que nunca se compra un acompañamiento por una nota y que la confirmación coincide con carrito/datos persistidos. Es prioridad mayor que seguir ampliando indefinidamente alias raros.
3. **Tanda 60: cierre e interrupciones cruzadas.** Preguntas de precio/contenido/tiempo durante nombre, dirección, pago y confirmación; cambio de dirección con interiores; teléfono y nombre junto al pago; rechazo de dirección anterior; sí/no ligados a la pregunta vigente. Reproducir los chats reportados literalmente y añadir contrastes, sin imponer una sola redacción como prueba de comprensión general.
4. **Trazabilidad de incidentes.** Crear o completar matriz por chat con identificador anonimizado, fuente/página, fallo, expectativa, ruta del test, commit corregido y runtime verificado. Estados: reproducido / corregido en mocks / validado real / pendiente por audio o contexto ausente. Publicar pendientes concretos; no afirmar cobertura total del PDF hasta reconciliar cada conversación. Revisar también órdenes vacías/duplicadas y correcciones afirmadas sin persistencia.
5. **Candidato y evaluación reservada real.** Congelar SHA y configuración efectiva. Ejecutar un conjunto pequeño de conversaciones reservadas completas con presupuesto explícito y registro antes de red; no reutilizar solo frases de desarrollo. Separar texto, transcripción de audio, visión y mapas; un mock no prueba sus proveedores. Medir exactitud de líneas/cantidades/opciones/notas/datos, turnos evitables, costo total por conversación y latencia p50/p95. Parar ante fallo crítico, reproducirlo gratis y revalidar sin gastar por repetición rutinaria. Esta sesión no ejecuta llamadas pagadas.
6. **Piloto supervisado.** Solo tras cerrar los fallos críticos reproducidos del candidato y comprobar las protecciones operativas vigentes. Alcance efectivo y transferencia. Supervisión humana y reversión preparadas; observar pedidos limitados y revisar divergencias antes de ampliar. Kamppo necesita después aislamiento por tenant y configuración de catálogo/negocio, no copiar excepciones de PPP.

## Puertas de salida

- Cero pedidos vacíos, duplicados o artículos extra en los recorridos críticos reservados; no perder cantidades, opciones, notas ni datos explícitos.
- Correcciones y consultas pueden volver al cierre sin reiniciar. Una dirección incierta pide el dato faltante y no se presenta como validada.
- Respuesta y orden simulada/real coinciden; cada cambio posterior al resumen exige una nueva revisión antes de confirmar.
- Evidencia real separada de mocks y vinculada al candidato/modelos efectivos. Costo y latencia medidos; definir límites comerciales a partir de esos datos, no inventar rentabilidad.
- Cero críticos conocidos sin contención antes del piloto; el piloto supervisado no equivale a venta autónoma sin seguimiento.

## Cuellos de botella: qué mejoró y qué falta

Resuelto parcialmente: el archivo gigante se particionó sin aumentar artificialmente cobertura; auditoría registra reducción histórica de 21m37s a 6m31s. La global de tanda 57 midió 111.3s de ráfagas aisladas + 368.0s del resto, aproximadamente 8min. No prometer igual duración en otra máquina. Tres particiones principales ocuparon 124.4s, 117.7s y 113.6s. Siguen siendo el límite práctico de una validación completa.

Cadencia: (a) baseline del nuevo contrato; (b) suites focalizadas al iterar; (c) TypeScript/build y Node; (d) una global final si cambian reglas compartidas, ráfagas aisladas y resto con cuatro workers; (e) comprobar inventario exacto y hashes de fuente. No lanzar varias globales ni editar durante ellas. Repetir únicamente por cambios o fallos que lo justifiquen. Tests sin cambios de runtime requieren controles proporcionales, no reconstrucción rutinaria.

Agrupar despliegues validados; no construir por documentación. No repetir matriz MariaDB sin cambios de persistencia. No crear agentes o validadores competidores en el mismo checkout. Si las particiones vuelven a dominar el tiempo, perfilar y dividir preservando el inventario, no borrar pruebas ni aumentar workers sin medir.

Pendiente organizativo: los relevos acumulan encabezados históricos. Mantener un inicio vigente breve y referencias de evidencia; no confundir un estado antiguo con runtime actual. La matriz de incidentes y las conversaciones reservadas son hoy un hueco más importante para la decisión comercial que sumar cientos de paráfrasis similares.

## Procedimiento para quien continúe

Leer AGENTS.md y encabezados de WHATSAPP-LOCAL-NEXT-AGENT.md / whatsapp-next-batches.md. Fetch origin/staging, comprobar rama limpia y ausencia de validaciones concurrentes. Conservar trabajo ajeno. Seguir tanda 59 después de cerrar 58, sin perseguir indefinidamente el subárbol de alternativas. Documentar evidencia y límites por lote. Main requiere solicitud explícita; despliegue staging usa el compose y procedimiento de AGENTS.md, preservando bases/volúmenes/privados. No activar el schedule cancelado.
