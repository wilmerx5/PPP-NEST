# Tanda 232 — destinatario junto a consulta y datos de cierre

Base `08d14825`, staging. El perfil231 está desplegado; esta tanda identifica fallos anteriores del router de instrucciones combinadas que también afectan correcciones de ese destinatario.

## Reproducción y cambios

Baseline24 casos:12 verdes/12 rojos. Nombre+pago y nombre+teléfono funcionaban. Nombre+dirección cambiaba dirección pero ignoraba destinatario. Nombre+consulta de domicilio respondía costo sin actualizar nombre.

Con carrito abierto y dos cláusulas separadas por salto de línea/punto y coma, nombre explícito válido más dirección explícita se procesan por separado: se guarda y reconoce el destinatario y se deja el domicilio al manejador existente. Funciona en ambos órdenes. No se añaden productos ni excepciones por restaurante.

El separador existente de consulta+contacto ahora conserva nombre/teléfono explícito aunque todavía no haya respondido ninguna de las consultas; una única consulta no resuelta continúa por el router sin incluirla en el campo de contacto. La respuesta de costo de domicilio resuelto agrega el recordatorio del paso pendiente. No confirma una orden por corregir datos.

## Validación

36 conversaciones nuevas: tres menús×agente simulado off/on×seis caminos (pago/dirección/teléfono/consulta y órdenes inversos de dirección/consulta). Comprueba respuesta y guía, nombre, carrito intacto, dirección/teléfono cuando corresponde, tarifa, estado y DTO de una sola orden tras confirmar. Foco317/317 en6 suites; TS general/build, Node92 y Falafel1 verdes. Global19.889/301 suites,609 hashes,1079,81s; inventario exacto y fuente sin cambios. Evidencias `/tmp/ppp-232-*`.

## Límites y continuación

Modelo, Google, Meta y órdenes externos simulados; cero gasto API. No acredita toda frase libre, cambios condicionales ni edición después de una orden confirmada. No se cambia el perfil ni las cuentas vinculadas. El procesamiento de dos cláusulas de dirección exige estructura explícita; más datos libres siguen por las rutas anteriores.

Siguiente: corrección de destinatario con pregunta antes de confirmar, negativa a usar el perfil y destinatarios de conversaciones antiguas; condiciones como «si puede, déjalo a nombre de…» deben aclararse sin afirmar cambios inexistentes. Ampliar estados y controlar que una consulta no autorice confirmación.

Main/modelos intactos. Publicación staging sin despliegue para agrupar tandas. Último staging desplegado231 `1f0a2f8c`, healthy verificado26/10;232 pendiente de despliegue. No declarar vendible por conteos.
