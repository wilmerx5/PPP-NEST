# Pruebas gratuitas de WhatsApp: ejecución por bloques

## Suite general repartida

El archivo histórico whatsapp-general-accuracy.spec.ts se repartió en 12 archivos del mismo directorio, con prefijo whatsapp-general-accuracy. El original conserva un grupo; los otros archivos contienen el resto. No importar un spec desde otro spec: Jest ejecutaría casos duplicados. El simulador está en whatsapp-accuracy.test-support.ts y está excluido del build productivo. No incluye llamadas a modelos, Meta ni creación de órdenes externas.

La partición inicial conservó los 512 bloques de prueba existentes sin modificar su contenido; evidencia en whatsapp-accuracy-partition-1910.json. Los archivos se equilibraron por tiempo histórico, no por cantidad de líneas. Los nombres describe/it se conservan y permiten buscar familias con rg o --testNamePattern. No usar el número de archivos como medida de cobertura.

## Cadencia

1. Reproducir una familia en su archivo específico, con respuesta, carrito, estado y DTO simulado.
2. Corregir y ejecutar controles focalizados durante el bloque. Incorporar varios recorridos relacionados antes de cerrar.
3. Pasar TypeScript, validación del build y contratos Node.
4. Congelar fuente y ejecutar una única global al cierre del bloque. No editar durante ella ni iniciar otra suite concurrente.
5. Publicar/desplegar staging solo con resultado y hashes verificados. Main se conserva.

Comandos desde la raíz:

```bash
# Una familia nueva o una selección de casos
npx jest whatsapp-checkout-destination-block --runInBand
npx jest whatsapp-general-accuracy --maxWorkers=4 --testNamePattern='Fresh destination request'
# Todos los tests del antiguo archivo general
npm run test:whatsapp:accuracy -- --silent
# Global: incluye los nuevos archivos además del archivo general repartido
npx jest --maxWorkers=4 --silent --json --outputFile=/tmp/ppp-global.json
npx tsc --noEmit
npx tsc --noEmit -p tsconfig.build.json
node --test scripts/*.test.cjs
```

Cuatro workers es el límite probado en este equipo, no una obligación para servidores con menos memoria. Usar dos si faltan recursos. La comparación inicial también cambia workers de dos a cuatro; no atribuir toda la mejora de tiempo solo a la partición. No afirmar mejora de comprensión del modelo por estas pruebas simuladas. Los replays usados para desarrollar dejan de ser evaluación reservada.
