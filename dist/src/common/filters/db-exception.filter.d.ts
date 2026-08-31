import { ExceptionFilter, ArgumentsHost } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
export declare class DbExceptionFilter implements ExceptionFilter {
    private readonly logger;
    catch(exception: QueryFailedError, host: ArgumentsHost): void;
}
