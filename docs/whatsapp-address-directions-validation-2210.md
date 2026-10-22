# Tanda 108 — dirección, referencia y correcciones durante el cierre

Base 2bef214f, staging. Prioridad del usuario: dirección que antes funcionaba, esquina, al frente de, interiores y correcciones.

## Reproducción

60 casos iniciales: 28 fallan y 32 pasan. Fallos en separación de «esquina», «alfrente», «a un costado», «queda al frente», acceso por visitantes, portería y casa esquinera. También referencias antepuestas y recortes de intersecciones o nombres de edificios. El patrón tradicional «frente al parque» y la vía exacta del chat ya estaban cubiertos por 101/106.

Después se probaron respuestas tras un resultado de Maps con otra puerta. 9/66 fallaron: seis repeticiones de pedir calle/número ya recibidos y tres respuestas del agente que declaraban dirección confirmada. No se cuentan esos nueve como pruebas independientes del total final.

## Cambios

- Separación de referencias por patrones generales, sin nombres o direcciones de PPP.
- Referencia inicial delimitada por punto y coma o salto de línea: se extrae cuando lo siguiente contiene una vía numerada completa.
- Solo separar después de una vía completa o un lugar nombrado. No recortar «calle 10 en la esquina con carrera 20», una segunda vía ni nombres como «Edificio La Esquina» / «Conjunto Frente al Parque».
- Con vía numerada ya recibida, un resultado ambiguo pide ubicación para precisar el punto; no vuelve a pedir la misma calle y número ni dice que el lugar no existe.
- Protección en la respuesta final: con domicilio y tarifa explícitamente nula tras fallo, no emitir «tu dirección ya está confirmada» como si hubiera validación. Con tarifa válida, incluido cero, no bloquear la confirmación. No cambia el estado ni inventa geocodificación.

## Pruebas nuevas

90 casos en whatsapp-address-directions.spec.ts. Tres menús (bowl, hamburguesa y pizza), agente on/off:

- 30 controles de separación y conservación, incluidos interiores y referencias antes de la calle.
- 24 conversaciones hasta DTO simulado, conservando referencia y producto, sin dirección anterior.
- 6 correcciones de una dirección ya cotizada: eliminan coordenadas y precio antiguos y recotizan.
- 6 referencias antepuestas, 6 resultados con otra puerta rechazados.
- 6 protestas del usuario con respuesta ficticia de dirección confirmada: no se emite esa afirmación ni se crea orden después de «confirmar».
- 12 contrastes de tarifa válida (cero o positiva).

El harness general reemplaza reply. Estos casos restauran la función real de respuesta y mantienen sendReplyNow simulado, para validar protección y formato visibles. Sin esta restauración una prueba del filtro final no lo estaba ejercitando.

Foco final: 288/288, siete suites. La primera selección de suites contenía una ruta inexistente (whatsapp-delivery-routing.service.spec.ts); se corrigió a whatsapp-delivery-routing.spec.ts. No fue un fallo del producto.

## Límites y próximos pasos

Google y el modelo están simulados; esto acredita consulta, aceptación/rechazo, carrito, estado, respuesta y DTO, no que Google hoy devuelva la puerta exacta del cliente. No se debe aceptar una puerta diferente para ocultar un fallo. Mantener pin de WhatsApp como recuperación.

La referencia antepuesta sin delimitador, los cruces de calles sin número de puerta y otras formas de afirmar una verificación no están acreditados por esta tanda. El guard de confirmación cubre la familia «dirección … está/quedó/queda confirmada/verificada/validada/ubicada»; no es garantía sobre cualquier paráfrasis del modelo. Siguen pendientes abreviaturas de sustitución de combos (tanda 107).

Sin llamadas pagadas, WhatsApp ni órdenes externas. Main y producción intactos. Publicar Git no equivale a desplegar; registrar cierre tras verificación.

## Validación final

TypeScript general/build OK; Node 92/92; diff --check OK. Global: 80/80 + 15.825/15.825 = 15.905, 191 suites, unión exacta del inventario y 489 hashes congelados. Duraciones 64,142 s + 457,245 s. Sin reintentos de la global. Logs locales /tmp/ppp-t108-{bursts,rest}.json y /tmp/ppp-t108-targets-final.log.

## Despliegue verificado

Desplegado y verificado en staging el 22/10 a las 14:31 Bogotá: 34311fd1, imagen 5045bad1…, running/healthy, 0 reinicios, health OK, DB connected, circuito CLOSED. Rollback rollback-before-34311fd1. Producción conserva imagen 1d512d0c…; Main intacto.
