# Regresión: matching de productos WhatsApp

Casos que **no** deben volver a fallar. Tras cambios en `whatsapp-catalog.service.ts`, verificar mentalmente o con un script.

## Regla de oro

> Si el cliente nombra un plato **corto**, **nunca** elegir un SKU más largo que solo **contiene** ese plato (menú ejecutivo, duo, combo, bandeja…) **salvo** que el cliente diga esas palabras.

## Casos obligatorios

| Mensaje del cliente | Debe matchear | NO debe matchear |
|---------------------|---------------|------------------|
| `quiero un pollo frito` | Pollo Frito / 1 Pollo Frito | Menú ejecutivo con pollo frito |
| `quiero un pollo frito, por favor` | Pollo Frito (NO multi-plato) | Bandeja con pollo frito |
| `quiero un pollo frito para el conjunto senderos de santa ana` | Pollo Frito + domicilio | Menú ejecutivo… |
| `quiero un pollo frito par ale conjunto senderos…` (typo para) | Pollo Frito + domicilio | Menú ejecutivo… |
| `pedi una hamburguesa` | Hamburguesa | Duo de hamburguesas |
| `pedi el duo de hamburguesas` | Duo de hamburguesas | (ok) |
| `3 churrascos, 2 mojarras y 4 limonadas` | 3 + 2 + 4 ítems correctos | solo limonadas / qty mal |
| `para el combo no quiero arepas, quiero más papas` (con combo ya en carrito) | Nota en el combo | agregar Arepa al carrito |
| `sin yuca más papa` | Nota de guarnición | agregar Yuca / Papa como platos |
| `pedi dos sopas de ajiaco pequeñas` | Sopa pequeña (+ attr Ajiaco) x2 | Sopa De Ajiaco (grande) |
| `sopa de mondongo pequeña` | Sopa De Mondongo Pequeña | Sopa De Mondongo |
| `sopa de ajiaco grande` / `sopa de ajiaco` | Sopa De Ajiaco | Sopa pequeña |
| `tres churrascos, dos mojarrras y una limonada` | 3 Churrasco + 2 Mojarra + 1 Limonada | 2 churrascos + limonada (sin mojarra) |

## Checklist al tocar matching

1. ¿El score premia **contención** (`name.includes(query)`) sin penalizar tokens extra (`menu`, `ejecutivo`, `duo`)?
2. ¿En empate se prefiere el nombre **más corto**?
3. ¿Se separa el domicilio (`para …`) **antes** de buscar producto?
4. ¿Typos frecuentes (`par ale`, `hamburegsa`, `churrrascos`) se normalizan?
5. ¿Hay un caso nuevo en esta tabla?

## Cómo evitar errores “tontos”

1. **No confiar en substring**: “X” ⊂ “Menú con X” es sospechoso.
2. **Tokens de envoltorio** (`menu`, `ejecutivo`, `duo`, `combo`, `bandeja`): si el cliente no los dijo → penalizar.
3. **Domicilio aparte**: nunca buscar producto con “para el conjunto…” pegado.
4. **Casos de regresión**: cada bug de producción → una fila en esta tabla **y** un test en `*.matching.spec.ts` / `whatsapp-intent.spec.ts`.
5. **Probar el mensaje exacto del usuario** (con typos) antes de cerrar el fix.

## Suite ejecutable

```bash
cd PPP-NEST && npm run test:whatsapp
```

Cubre: intención (nota vs pedido), glosario (typos), sopas pequeña/grande, notas de guarnición.
