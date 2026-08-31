import { DataSource } from 'typeorm';
import { CommonService } from './common.service';
export declare class CommonController {
    private readonly commonService;
    private readonly dataSource;
    constructor(commonService: CommonService, dataSource: DataSource);
    dbHealth(samplesRaw?: string): Promise<{
        samples: number;
        roundTripMs: {
            min: number;
            avg: number;
            p50: number;
            p95: number;
            max: number;
            all: number[];
        };
        dailyOrderMaxQueryMs: number;
        note: string;
        estimatedOrderNetworkFloorMs: number;
        verdict: string;
        timestamp: string;
    }>;
}
