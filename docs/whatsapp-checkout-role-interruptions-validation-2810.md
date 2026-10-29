# Tanda270: interrupciones de nombre y lugar

Base fb0e2c6d, continuación de269. Un cliente puede enviar la calle y apartamento antes de aclarar que el rótulo anterior es un conjunto, pedir recogida o añadir otro producto antes de dar su nombre.

El router conservaba la calle nueva pero la descartaba al recibir «es el conjunto». La unidad se guardaba por otra ruta y se perdía al reconstruir esa dirección. La recogida dejaba pendiente la duda nombre/lugar; una adición explícita durante la pregunta de nombre se rechazaba como nombre inválido y un nombre explícito posterior no siempre liberaba la duda.

Se conserva exclusivamente una calle aceptada durante la duda mediante el campo JSON opcional `pendingRecipientOrPlaceAddress`, incluyendo cambios de apartamento. Cambiar a recogida limpia ambos campos. La adición explícita de catálogo vuelve al flujo de compra manteniendo la duda pendiente y un nombre explícito posterior la resuelve. Direcciones previas guardadas no se recuperan como nuevas. Un pin nuevo invalida la calle recordada para impedir restaurar un destino anterior; aclarar el conjunto después del pin todavía requiere volver a aportar el destino completo.

54 regresiones nuevas: tres cartas × agente simulado off/on. Incluye DTO final con calle, conjunto, producto añadido y nota original; controles para dirección antigua, pregunta de rol, pregunta de compra, reemplazo de calle y ubicación. Baseline inicial:24 fallos/12 aprobadas;18 controles adicionales incorporados después. Foco426/6 aprobado. Global aprobada: 21404 pruebas/334 suites; TypeScript general/build y Node aprobados. Despliegue staging pendiente.

Modelos y servicios externos simulados. Sin inferencia pagada, Meta, órdenes externas ni cambios de modelo. No acredita audio/PDF/canal reales. Campo opcional sin migración SQL; resolver o cancelar normalmente borradores afectados antes de rollback. Producción sigue265 y delta266–270 queda pendiente de portar a Kamppo.
