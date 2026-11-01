# Tanda329 — ejecutivo fragmentado y cambio de preparación

Fuente: mensajes315–324 del31/10; fixtures sintéticos sin datos personales. Baseline8 casos:7 fallan,1 pasa.4 fallos de opción Mondongo en mensajes separados;3 fallos de sustitución según catálogo/ruta simulada. La ampliación de ráfaga reprodujo además4 fallos: pollo entero añadido o elegido en lugar del plato. No atribuir la causa al modelo a partir de estos mocks.

Correcciones genéricas:
- Unir familia, preparación y colas de opciones en una ráfaga solo si identifican un único plato de catálogo, sin cantidades adicionales ni cláusulas ajenas.
- Permitir corregir una opción anterior/default mientras se espera otra, mediante un nombre completo único (admite omitir paréntesis explicativos). En carrito, expandir abreviatura única y conservar aclaración de propietario.
- «El plato lo quiero con …» resuelve la preparación dentro de la familia existente, comprueba disponibilidad y usa reemplazo atómico preservando opciones compatibles/notas. El título de catálogo no se convierte en nota de cocina.

28 casos:2 catálogos × agente off/mock × mensajes separados/ráfaga/cambio/agotado/propietario ambiguo/repetición/nota.20 recorridos completos hasta DTO y recibo;8 controles sin mutación por agotado/ambigüedad. Foco243/5 aprobado. Primera global interrumpida: la modificación inicial del resolvedor completaba prematuramente la bebida al corregir una opción. Se retiró esa modificación y se amplió la ruta existente absorbPendingOptionAnswer; regresión corregida y controles intermedios reforzados. Global final32739/396 aprobado,613 fuentes congeladas, TypeScript general/build y scripts aprobados; sin despliegue todavía. Se agrupará con la corrección de listas de pollo y medio solicitada durante la validación.

Sin inferencia pagada, Meta ni órdenes externas. Producción/Kamppo sin cambios. La ráfaga usa handleIncoming con temporizadores simulados; no acredita webhook real, reintentos distribuidos ni persistencia. Mantener grupoB abierto. Siguiente prioridad: grupoD, reparto «uno frito y uno broaster», sustitución de combos y extras incluidos.

Despliegue conjunto329–330 verificado en staging: código `1528b08c`, healthy, cero reinicios, API local/pública ok y modelos/configuración privada preservados. Workflow41321467542; evidencia `whatsapp-batch-330-staging-deployment.json`. Controles compilados previos aprobados; casos329/330 verificados localmente.
