"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("../src/app.module");
const factus_service_1 = require("../src/factus/factus.service");
async function main() {
    const args = process.argv.slice(2).filter((a) => a !== '--');
    const limitArg = args.find((a) => /^\d+$/.test(a));
    const includeAll = args.includes('--all');
    const limit = limitArg ? parseInt(limitArg, 10) : 4;
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule, {
        logger: ['error', 'warn', 'log'],
    });
    try {
        const factus = app.get(factus_service_1.FactusService);
        console.log(`[backfill] Factus → standalone DB (limit=${limit}, solo-lote=${!includeAll})`);
        const result = await factus.backfillStandaloneInvoicesFromFactus({
            limit,
            includeOrderInvoices: includeAll,
        });
        console.log(JSON.stringify(result, null, 2));
        if (result.inserted === 0 && result.skipped > 0) {
            console.log('\nNada nuevo insertado. Puede que ya estén en BD o no haya FE de lote recientes.');
        }
    }
    finally {
        await app.close();
    }
    process.exit(0);
}
main().catch((err) => {
    console.error('[backfill] Error:', err instanceof Error ? err.message : err);
    process.exit(1);
});
//# sourceMappingURL=backfill-factus-standalone-invoices.js.map