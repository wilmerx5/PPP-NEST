import { DataSource } from 'typeorm';
import { AppService } from './app.service';
export declare class AppController {
    private readonly appService;
    private readonly dataSource;
    constructor(appService: AppService, dataSource: DataSource);
    health(): Promise<{
        status: string;
        db: string;
        timestamp: string;
    }>;
}
