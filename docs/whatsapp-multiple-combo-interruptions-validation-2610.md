# Tanda 214 — negativa y contacto durante alternativas de combo

Base `aaaa57af`, staging. Cambios genéricos por intención y estructura; Main/producción intactos. Sin llamadas pagadas, Meta ni órdenes externas.

## Fallos reproducidos

18/18 conversaciones de rechazo compuesto fallaron: con varias presentaciones, «no, mejor una gaseosa 400ml Pepsi aparte», «no gracias ... por separado» y «sin combo ... aparte» podían seleccionar el combo por sabor/volumen. Evidencia `/tmp/ppp-214-baseline.json`. Se mueve la guarda existente de rechazo y compra separada antes de seleccionar candidatos; reutiliza el procesamiento normal de la bebida y conserva el plato base con sus unidades/opciones/notas.

Contacto:18 conversaciones,12 verdes/6 rojas (`/tmp/ppp-214-contacts-baseline.json`). Datos separados y corrección posterior funcionaban; nombre+teléfono+dirección juntos fallaban por una causa general de dirección: «Torres» coincidía como «torre S». La detección/resolución/actualización de interiores ahora exige límite de palabra o dígito tras la etiqueta. Conserva «torre4», «torre A», «torre#4» y «torre.4», sin convertir apellidos en unidades. No usa lista de nombres propios ni excepción PPP.

## Cobertura

36 nuevas conversaciones completas, tres menús (arroz, bowl, pasta)×agente mock off/on:18 rechazos con compra aparte y18 contactos separados/juntos/corregidos. Verifican respuesta, estado pendiente, carrito, cantidades/opciones/notas y orden simulada única; en contactos, nombre/teléfono/dirección del DTO. Diez controles nuevos del parser cubren palabras largas/apellidos, conflictos reales y resolución/actualización que no reescribe el apellido. La validación de contactos no acredita geocodificación real.

Primera verificación corregida74/74 en3 suites (incluye controles anteriores de dirección); después se agregó el control de actualización. Foco final285/285 en10 suites; TypeScript general/build, Node92 yFalafel1 aprobados. Global final19.188/19.188 en280 suites,587 hashes sin cambios e inventario exacto,743,23s (`/tmp/ppp-214-final-global-summary.json`). Fuente congelada durante ambas particiones; sin suites omitidas/duplicadas.

## Siguiente bloque y límites

Preguntas por código/contenido durante alternativas y opciones distintas entre candidatos. Rechazos cubiertos contienen negativa explícita y compra aparte; no extrapolar a todas las negativas ni mensajes libres. Contactos son explícitos y dirección numerada; nombres sin etiqueta, datos incompletos y cambios de dirección reales requieren más cobertura. Ampliar antes con foco, después global congelada, sin editar durante validación. No declarar vendible por conteos.

Sin cambios de modelos ni ahorro medido; publicación solo staging y despliegues agrupados.
