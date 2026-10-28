# Tandas 258–259: pedidos coloquiales de combo

Base: `344ded5ffcac7659cf37241189fcaa89d37daad9`, staging. El usuario pide que el cliente pueda hablar naturalmente, sin repetir literalmente el nombre de la carta. Estas frases nuevas son variantes sintéticas derivadas de sus reportes; no se cuentan como nuevos chats reales ni evaluación reservada.

258 normaliza «combito» y «de combo» dentro de la ruta acotada de compra explícita de combo. 259 reconoce una cláusula final «y <atributo> <opción>» como opción incluida cuando coincide exactamente con el catálogo del combo elegido, antes de decidir si el mensaje contiene varios platos. Conserva la ruta general para cantidades separadas, extras y cláusulas desconocidas. No se codifican nombres, IDs ni precios de PPP en producción.

Baseline sobre 36 combinaciones: 26 pasaron y 10 fallaron. «En combito» perdía el plato y «dame un … de combo … y arepas fritas» podía añadir una gaseosa suelta. Una primera normalización local no bastó: el detector de varios platos aún interpretaba la opción final como otro plato. Se corrigió esa clasificación usando las opciones del catálogo. Las expectativas originales se conservaron.

Foco final: 180/180, tres suites, incluidas 60 nuevas: seis formas de compra × tres menús × agente simulado off/on; dos preguntas sin compra; una bebida previa conservada; y gaseosa adicional explícita conservada aparte. Se verifican carrito y respuesta. Persistencia, modelo, Meta y órdenes externas simulados; cero inferencia pagada. La global, TypeScript y auxiliares se registran en `whatsapp-batch-258-259-validation.json` al aprobarse.

Límites: no demuestra comprensión universal de diminutivos, typos o instrucciones arbitrarias. La opción final necesita nombre y valor del catálogo; no se amplía el contrato de repartos entre ejecutivos ni se afirma haber evaluado acústicamente los audios. Continúan pendientes los recorridos08/28 y otros compuestos del corpus, muestra independiente/modelos/medios/canal y piloto supervisado. Presupuesto compartido267 autorizadas/256 usadas/11 restantes; modelos y producción244 sin cambios. Sin nueva persistencia ni cambio de esquema.
