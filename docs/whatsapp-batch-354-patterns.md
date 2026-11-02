# Tanda354 — etiqueta de contacto fuera de la dirección

## Evidencia

Chat02/11 13:18–13:23 compartido por usuario: dirección con conjunto/torre/apartamento seguida por número de contacto y «celular». El teléfono se extrajo pero «celular» permaneció en dirección y recibo. Fixtures usan teléfonos/lugares sintéticos, sin copiar datos personales.

Baseline válida28 fallos/40,12 aprobados. Una primera ejecución32/40 incluía una expectativa incorrecta de estado interno tras lugar no resuelto; se corrigió para comprobar la petición observable de calle/número y se repitió antes de modificar producción.

## Cambio

Antes de los patrones existentes, reconoce número móvil colombiano válido con etiqueta posterior (cel/celular, tel/teléfono, WhatsApp/WA), incluyendo +57 y dígitos espaciados. Extrae número y etiqueta juntos, solo ante fin de cláusula o detalle de entrega; no elimina palabras globalmente. Mantiene validación/normalización de teléfono existentes y conserva referencias como «Celular Express» o «teléfono público» cuando son parte de un lugar.

44 regresiones:32 recorridos en dos catálogos × agente off/mock × calle presente/pendiente ×4 formatos de contacto;4 contactos anteriores a torre/apartamento;8 guardas de referencia y número incompleto.32 cierres verifican DTO/recibo simulado, teléfono correcto, producto y total27.000, conjunto/torre/apto conservados sin etiqueta. Foco258/5 y final44/1 aprobados. Primera global interrumpida por SIGTERM (exit143) tras11 suites aprobadas, sin fallos registrados; no cuenta como global completa. Se repite con4 workers para reducir carga. Global33919/422 aprobada,640 fuentes congeladas e inventario exacto; TypeScript general/build y scripts aprobados. Despliegue pendiente de verificación.

## Límites y siguiente paso

Cero inferencia pagada, Meta o pedidos externos; no acredita modelo/canal real. No sanea órdenes históricas; cubre extracción de contacto en nuevos mensajes. Números incompletos permanecen visibles, no se asumen como teléfonos válidos. Producción349 y Kamppo321 sin cambios. Próximo: cambiar/retirar producto durante aclaración de nota y evitar aplicar selección sobre carrito desactualizado. U3/U4 siguen abiertos.
