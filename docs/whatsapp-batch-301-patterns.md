# Tanda301 — producto ambiguo en operación combinada

## VIGENTE — tanda301: elección de producto en retirada y adición (29/10)

Base `2002bd3f`. Cuando el destino no tiene coincidencia exacta pero coincide con el inicio literal de2–8 nombres disponibles distintos, conserva ambas acciones y pregunta qué producto agregar. No usa coincidencia aproximada ni subcadenas dentro de palabras. El título exacto mantiene prioridad. Orden de listas: producto, línea a retirar si hace falta, atributos. Resuelve producto por número, nombre completo u ordinal; revalida precio/disponibilidad/opciones antes de continuar. Total, cancelación, reinicio y nueva compra independiente preservan su semántica; ninguna retirada aislada. Nombres duplicados indistinguibles, condiciones y listas excesivas permanecen bloqueados.

324 pruebas nuevas:288 recorridos (3 catálogos ×2 agentes simulados ×origen único/ambiguo ×con/sin atributo ×cantidad1/3 ×6 formas de selección/interrupción);20 controles de cambio de precio/stock/opciones/carrito, pago, límites, pregunta/confirmación, selección inválida y caducidad;12 límites de catálogo;4 cambios a compra independiente. Baseline308 fallidos; primera corrección detectó96 rechazos por palabra corta «té» en «té frío», ajustados sin abrir coincidencias parciales. Foco1334/5 aprobado. Global27852/368, inventario exacto y581 fuentes congeladas; TypeScript general/build y Node aprobados. Evidencia `whatsapp-batch-301-validation.json`.

Despliegue staging pendiente de verificación en este registro. Último runtime verificado:staging300, producción292, Kamppo282. Cero inferencia/Meta/órdenes externas; ledger267/256/11 intacto. Idiomas aplazados. Pendiente: opciones expresadas libremente juntas y reparto de sabores entre unidades. Selección por prefijo literal acotado, no resolución universal de categorías ni planificador general.

Fuente conceptual: alternativas de bebidas y correcciones aportadas en el hilo, y límite documentado300. Recorridos sintéticos con carritos preparados; no se releyeron chats/PDF/audio nuevos. No acredita comprensión con modelo real ni todos los nombres coloquiales de categorías.
