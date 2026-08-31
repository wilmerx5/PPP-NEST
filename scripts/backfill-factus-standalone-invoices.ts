/**
 * Backfill: trae las últimas N FE de lote desde Factus y las guarda en
 * ppp_factus_standalone_invoices (para que aparezcan en admin /facturas).
 *
 * Uso:
 *   npm run factus:backfill-standalone
 *   npm run factus:backfill-standalone -- 1
 *   npm run factus:backfill-standalone -- 4 --all
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { FactusService } from '../src/factus/factus.service';

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== '--');
  const limitArg = args.find((a) => /^\d+$/.test(a));
  const includeAll = args.includes('--all');
  const limit = limitArg ? parseInt(limitArg, 10) : 1;

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const factus = app.get(FactusService);
    console.log(
      `[backfill] Factus → standalone DB (limit=${limit}, solo-lote=${!includeAll})`,
    );
    const result = await factus.backfillStandaloneInvoicesFromFactus({
      limit,
      includeOrderInvoices: includeAll,
    });
    console.log(JSON.stringify(result, null, 2));
    if (result.inserted === 0 && result.skipped > 0) {
      console.log(
        '\nNada nuevo insertado. Puede que ya estén en BD o no haya FE de lote recientes.',
      );
    }
  } finally {
    await app.close();
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('[backfill] Error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
