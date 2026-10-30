# Tanda323 — prioridad por impacto y cierre con total compuesto

## Prioridades

1. Evitar cantidades/productos/notas incorrectos y pedidos duplicados; verificar el DTO final, no solo el texto.
2. Validar un recorrido acotado con Luna/Sol reales y capturar sus decisiones para regresión gratuita. Máximo11 solicitudes restantes, una repetición y parada al primer fallo. No se ejecutó: clave ausente en entorno local y archivo privado consultado; SSH al staging agotó8 segundos. No se leyó ninguna clave remota.
3. Validar canal y persistencia con aislamiento comprobado; después revisar nuevas conversaciones y abandonos. Las pruebas simuladas no acreditan estos puntos.
4. Ampliar variantes cuando aporten comportamiento distinto. Idiomas siguen aplazados.

## Hallazgo reproducido

Después de dividir tres unidades y corregir la nota de dos, «no mas, cuanto es todo lo que pedi» no mostraba el total: agente desactivado respondía que el supuesto producto no existía; agente simulado activado respondía «¿Cuál prefieres?». Cuatro fallos reproducidos en dos catálogos;24 controles aprobados.

Se amplía exclusivamente la pregunta de total detrás de un cierre reconocido para aceptar «todo lo que pedí/he pedido/llevo». La regla sigue anclada: precio de un producto concreto o petición adicional de nota no se consumen como cierre.

26 pruebas nuevas:12 recorridos (cancelar y volver a solicitar, total tras revisar nota, repetir confirmación),12 combinaciones de cierre/total en dos catálogos con agente simulado off/on,2 límites de parser. Foco117/117 en2 suites. Los recorridos verifican tres unidades, notas dirigidas, total54000 y una creación; la confirmación repetida no duplica.

Global32611/390 aprobada con inventario exacto y fuentes congeladas; TypeScript general/build y scripts aprobados. Evidencia: whatsapp-batch-323-validation.json. Sin llamadas a OpenAI/Meta ni órdenes externas. Presupuesto267/256/11 intacto. No se afirma validación de modelos reales.

Staging323 desplegado y verificado: código `06cfcb08`, healthy, cero reinicios, API local/pública y DB operativas; configuración/modelos preservados. Workflow41090722171. Evidencia `whatsapp-batch-323-staging-deployment.json`; controles compilados previos aprobados, cobertura específica323 verificada localmente. Producción/Kamppo sin cambios.
