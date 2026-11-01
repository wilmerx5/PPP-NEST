# Tanda332 — reparar dos preparaciones y convertir ambos a combo

Fuente31/10 mensajes401–407: después de quedar dos fritos, el cliente corrige a uno frito y uno broaster; luego pide ambos en combo.8/8 controles iniciales fallaron en dos catálogos y con agente off/mock. La ruta mantenía el reparto incorrecto o los dos productos originales.

Se añade una corrección anticipada, delimitada por gramática explícita y catálogo: exactamente dos unidades de la misma familia. Una línea de cantidad dos se reparte en los dos productos nombrados; cada plato se sustituye por su único combo con identidad equivalente. Se conservan notas y atributos compatibles; las nuevas opciones deben estar completas según defaults configurados. Los cambios se construyen en memoria y se guardan juntos después de verificar stock, compatibilidad y límites. No se aplica el primer cambio si falla el segundo. Las selecciones/pagos pendientes se aclaran primero. El paso de checkout se conserva y las repeticiones no aumentan unidades.

48 controles nuevos aprobados; dos suites relacionadas,610 pruebas, aprobadas. La ampliación tuvo un error TypeScript en una aserción de atributo opcional, corregido antes del foco final48. Global final aprobada: 32815 pruebas/399 suites, inventario exacto y 616 fuentes congeladas; TypeScript general/build y scripts aprobados. No atribuir a un inventario final la ejecución focal anterior que contenía ese error de compilación.

Límites: no repara automáticamente dos líneas existentes con opciones diferentes cuando el propietario es ambiguo; no adivina equivalencias de combos con nombres distintos ni aplica opciones nuevas escritas fuera de esta gramática. Esos casos siguen por las rutas de aclaración. Cero inferencia, Meta y órdenes externas. Trabajo solo staging; Main/producción y Kamppo sin cambios.

Staging332 desplegado y verificado: código `a63e00b9`, healthy, cero reinicios, API local/pública ok y modelos/configuración privada preservados. Workflow41326043773; evidencia `whatsapp-batch-332-staging-deployment.json`. Controles compilados previos aprobados; cobertura específica332 verificada localmente.
