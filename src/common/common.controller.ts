import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { CommonService } from './common.service';

@ApiTags('diagnostics')
@Controller('common')
export class CommonController {
  constructor(
    private readonly commonService: CommonService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Mide la latencia real API -> DB (round-trip).
   * Útil para saber si la lentitud al crear órdenes es por red/DB remota.
   * GET /api/common/db-health?samples=10
   */
  @Get('db-health')
  @ApiOperation({ summary: 'Latencia round-trip a la base de datos (diagnóstico)' })
  @ApiQuery({ name: 'samples', required: false, example: 10 })
  async dbHealth(@Query('samples') samplesRaw?: string) {
    const samples = Math.min(Math.max(Number(samplesRaw) || 10, 1), 50);

    // Round-trip trivial (aísla latencia de red del trabajo de la DB)
    const pingMs: number[] = [];
    for (let i = 0; i < samples; i++) {
      const start = Date.now();
      await this.dataSource.query('SELECT 1');
      pingMs.push(Date.now() - start);
    }

    // Query realista: la que usa la creación de orden para el número diario
    let dailyMaxMs = -1;
    try {
      const start = Date.now();
      await this.dataSource.query(
        'SELECT MAX(daily_order_number) AS m FROM ppp_orders WHERE created_at > (NOW() - INTERVAL 1 DAY)',
      );
      dailyMaxMs = Date.now() - start;
    } catch {
      dailyMaxMs = -1;
    }

    const sorted = [...pingMs].sort((a, b) => a - b);
    const sum = pingMs.reduce((a, b) => a + b, 0);
    const p = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];

    const avg = sum / pingMs.length;

    let verdict: string;
    if (avg < 5) verdict = 'excelente (DB local / misma región)';
    else if (avg < 20) verdict = 'buena';
    else if (avg < 50) verdict = 'aceptable';
    else verdict = 'ALTA: DB remota — cada orden acumula segundos por las múltiples consultas';

    return {
      samples,
      roundTripMs: {
        min: sorted[0],
        avg: Number(avg.toFixed(1)),
        p50: p(0.5),
        p95: p(0.95),
        max: sorted[sorted.length - 1],
        all: pingMs,
      },
      dailyOrderMaxQueryMs: dailyMaxMs,
      note: 'Una orden ejecuta ~15-25 consultas en secuencia. Tiempo mínimo estimado ≈ avg × 20.',
      estimatedOrderNetworkFloorMs: Number((avg * 20).toFixed(0)),
      verdict,
      timestamp: new Date().toISOString(),
    };
  }
}
