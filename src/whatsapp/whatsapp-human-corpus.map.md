# Mapa de capacidades — corpus humano WhatsApp (PPP)

Fuente: ~55 chats reales cliente ↔ personal (ago 2026).  
**No es fine-tune:** reglas + glosario + tests. Cada fila = capacidad que el bot debe cubrir.

Regla de equipo: chat malo en prod → fila aquí **y** caso en `whatsapp-chat-regressions.spec.ts` / `whatsapp-human-corpus.spec.ts`.

## Flujo humano (plantilla)

1. Saludo / “para un domicilio”  
2. Plato(s) (+ attrs si faltan: bebida, presa, frito|broaster) — **una pregunta**  
3. Dirección (o “¿acá?” si hay historial)  
4. Cierre corto: “te enviamos lo más pronto”  
5. Si preguntan: total / ETA / medio de pago  
6. Post-pedido: “¿ya salió?” / demora / faltante → respuestas cortas o **humano**

## Capacidades (prioridad)

| ID | Capacidad | Ejemplos corpus | Estado código |
|----|-----------|-----------------|---------------|
| C01 | Dirección suelta con carrito (no plato) | Bosques/Terrazas de Castilla, Nuevo Sol, Tabaku T4 | ✅ landmark zona + address-only |
| C02 | Todo-en-uno (plato+dir+pago/cel) | Ejecutivo completo + dir; combo+calle+nequi | ✅ splitTrailingEmbeddedAddress + pago en msg |
| C03 | Multi-ítem en un mensaje | Arroz + ¼ pollo; 2 sopas + 2 ajiacos | ✅ multi-order |
| C04 | Notas de cocina / sustitución | sin ensalada, sin yuca→papa, más miel, sin cilantro | ✅ side notes + glosario |
| C05 | Typos / aliases | giger, broster, placha, plata→plátano, menundencia | ✅ glosario |
| C06 | Upsell combo opcional | “¿combo con gaseosa?” / “No, sólo” | ✅ soft hint tras agregar pollo |
| C07 | Explicar combo + precio | “qué significa en combo y cuánto” | ✅ formatComboExplanation |
| C08 | Mixto medio/medio | medio broaster medio frito | ✅ glosario → pollo mixto |
| C09 | Variantes arroz chino | caja / medio pollo / costillas / combo | ✅ family base + pickVariant |
| C10 | Maps / hotel / portería | link Google; portería; recepción | ✅ nota hotel/portería/recepción |
| C11 | Pago llave/nequi/daviplata | “te cancelo por llave” | ✅ keyword llave |
| C12 | Vueltas / billete | vueltas de 100; billete de 50 | ✅ notas efectivo |
| C13 | Post-pedido ETA/demora | “se demora?” “ya salió?” cancelar | ✅ isPostOrderFollowUpIntent |
| C14 | Queja / faltante | “no trajeron el arroz” | ✅ handoff en post-pedido |
| C15 | Consulta sin pedir | “tienes pollo? q precio?” | ✅ price / menu explore |
| C16 | Foto “esta / de estos” | imagen de menú | ✅ no inventar; pedir nombre/asesor |
| C17 | Puntos / código | redimir puntos | ✅ awaiting code + procedimiento redimir |
| C18 | Cobertura por dirección | “¿domicilios para Cra 81A…?” | ✅ tryHandleCoverageInquiry (probe fee) |
| C19 | Dirección guardada “acá” | staff propone dir previa | ✅ lastDeliveryAddress + sí/acá |
| C20 | Add-on tardío | “alcanzo una ensalada?” | ✅ glosario alcanzo→quiero |

## Glosario (ver `whatsapp-local-glossary.ts`)

Tests ejecutables: `whatsapp-local-glossary.spec.ts`, `whatsapp-human-corpus.spec.ts`.

## Landmarks zona PPP (ver `PPP_ZONE_LANDMARK_RE`)

Castilla (+ variantes), Nuevo Sol, Tabaku, Altavista, Techo, Tintal, Aralia, Vizcaya, Terrazas, Pio XII, Toledo, Natura, Galante, Mandalay, Plazuela San Esteban, …

## Suite

```bash
cd PPP-NEST && yarn test:whatsapp
```
