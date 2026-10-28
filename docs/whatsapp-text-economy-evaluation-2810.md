# Texto económico — tanda 244, 28/10/2026

Decisión tras la comparación autorizada: Luna para texto habitual y Sol para condiciones/repartos explícitos. La selección se realiza una vez al inicio del turno, antes de ejecutar herramientas; no se repiten compras al cambiar de modelo. Activación opt-in con `WHATSAPP_AGENT_MODEL=gpt-6-luna` y `WHATSAPP_AGENT_COMPLEX_MODEL=gpt-6.1-sol`. Sin el segundo ajuste se conserva el modelo principal. Visión/apoyo continúan Luna; audio GPT-Transcribe.

Luna sola completó PPP en un ensayo de desarrollo, pero otro agotó seis rondas con el pedido compuesto. Esto no justifica usarla sola para todas las entradas. La ruta nueva reconoce condiciones y reparto mediante patrones delimitados; no es un clasificador universal de complejidad ni una recuperación automática tras fallos.

La tanda también corrige dos problemas generales encontrados con inferencia real: conservar un aviso de omisión explícita sustentado por catálogo aunque el proveedor lo redacte distinto, y retirar una cláusula positiva exacta «con bebida anterior» al cambiar ese atributo, manteniendo exclusiones, otras notas y otras líneas. Controles en tres cartas, sin excepciones por productos PPP.

## Evidencia real acotada

Manifiesto e inputs: `scripts/fixtures/whatsapp-text-economy-comparison-2810.json`. Resumen reproducible con hashes de capturas, modelos efectivos, tokens, latencias y DTO sintéticos: `docs/whatsapp-text-economy-results-2810.json`.

- PPP, ocho turnos: mixto Luna/Sol aprobado, ocho solicitudes (tres Sol, cinco Luna), USD0.00922890 estimados. Control Sol aprobado, siete solicitudes, USD0.07779510.
- Falafel, trece turnos: ruta mixta aprobada (todas sus quince solicitudes fueron Luna), USD0.00468682. Control Sol aprobado, diez solicitudes, USD0.09272100.
- Ambos controles verifican respuesta/carrito por turno, ausencia de orden antes de confirmar y contenido del DTO final: productos, cantidades, bebidas y notas dirigidas. Meta, órdenes, persistencia, pagos y mapas simulados; solo OpenAI fue real.

Los costos observados difieren en caché y número de rondas. No son una predicción del ahorro en producción ni una superioridad estadística. Son casos conocidos de desarrollo, no holdouts. No se certifica todo chat.txt/PDF ni comprensión real de imágenes/audio.

Ocho runs, 69 intentos y USD0.19627041 estimados incluyendo fallos y desarrollo. Primer fallo: aviso omitido por renderizador; después se corrigió gratis. Un run de falafel quedó cortado por límite de diez solicitudes; no es un fallo de capacidad. Otro Luna llegó a max_iterations y motivó la selección previa. Sin reintentos ciegos: cada nuevo ensayo sigue diagnóstico/corrección o política explícita. Ledger acumulado267/256/11 (autorizadas/usadas/restantes), espejo privado sincronizado antes de cada solicitud. El tope numérico es operativo, elegido por el agente bajo autorización del usuario.

El runner ahora separa costo por modelo realmente solicitado y comprueba el DTO final, además de cart/estado/respuesta. Usage faltante produce incertidumbre, nunca costo cero. Estimaciones de tokens Standard, excluyen otros cargos/impuestos/precios particulares; no son factura. Tarifas por millón input/cache/output: Luna0.10/0.01/0.50 y Sol2/0.10/10, verificadas28/10 en [Luna](https://developers.openai.com/api/docs/models/gpt-6-luna) y [Sol](https://developers.openai.com/api/docs/models/gpt-6.1-sol).

## Validación y despliegue

Foco157/157 en9 suites y TypeScript aprobados. Validación consolidada20.314/315suites: primera pasada18fallos por dos mocks antiguos; solo esos mocks se actualizaron y sus45controles pasaron completos. Temporizadores87/87, TypeScript general/build y Node92/92 aprobados; inventario exacto y runtime intacto entre fases. No se declara una única global verde. Despliegue autorizado primero en staging y después producción: resultado definitivo en `docs/whatsapp-batch-244-validation.json` y `docs/whatsapp-batch-244-deployment.json` al cerrar la ejecución. No hay cambios de esquema ni pruebas con órdenes reales. Continúa pendiente evaluación integral de conversaciones históricas y una muestra independiente de tráfico.

Desplegado y verificado en staging y producción: código `9f94ef70`; modelos efectivos y selector compilado comprobados, HTTP200 local/público, DBconnected, cero reinicios. Cinco módulos compilados coinciden entre entornos. Compose y demás ajustes privados conservados; backups e imágenes de rollback disponibles. Las imágenes no requieren reconstrucción por el cierre documental posterior.
