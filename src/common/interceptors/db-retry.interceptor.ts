import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, throwError, timer } from 'rxjs';
import { retry } from 'rxjs/operators';
import { QueryFailedError } from 'typeorm';

function isTransientDbError(err: unknown): boolean {
  if (!(err instanceof QueryFailedError)) return false;
  const e = (err as any).driverError;
  const code = e?.code ?? (err as any).code;
  const errno = e?.errno;
  return (
    ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'PROTOCOL_CONNECTION_LOST'].includes(String(code)) ||
    (typeof errno === 'number' && (errno === -104 || errno === -111))
  );
}

@Injectable()
export class DbRetryInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const isGet = request.method === 'GET' || request.method === 'HEAD';

    if (!isGet) {
      return next.handle();
    }

    return next.handle().pipe(
      retry({
        count: 1,
        delay: (err) => {
          if (!isTransientDbError(err)) return throwError(() => err);
          return timer(300);
        },
      }),
    );
  }
}
