import { Injectable, Logger } from '@nestjs/common';

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  halfOpenMaxAttempts: number;
}

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private state = CircuitState.CLOSED;
  private failures = 0;
  private lastFailureTime = 0;
  private halfOpenAttempts = 0;
  private readonly config: CircuitBreakerConfig = {
    failureThreshold: 5,
    resetTimeout: 30000,
    halfOpenMaxAttempts: 3,
  };

  async execute<T>(fn: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime > this.config.resetTimeout) {
        this.state = CircuitState.HALF_OPEN;
        this.halfOpenAttempts = 0;
        this.logger.warn('[Circuit Breaker] Moving to HALF_OPEN state');
      } else {
        this.logger.warn('[Circuit Breaker] Circuit OPEN, using fallback');
        if (fallback) return fallback();
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      if (fallback) {
        this.logger.warn(`[Circuit Breaker] Operation failed, using fallback: ${(err as Error).message}`);
        return fallback();
      }
      throw err;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    if (this.state === CircuitState.HALF_OPEN) {
      this.halfOpenAttempts++;
      if (this.halfOpenAttempts >= this.config.halfOpenMaxAttempts) {
        this.state = CircuitState.CLOSED;
        this.halfOpenAttempts = 0;
        this.logger.log('[Circuit Breaker] Circuit CLOSED (recovered)');
      }
    } else {
      this.state = CircuitState.CLOSED;
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.OPEN;
      this.halfOpenAttempts = 0;
      this.logger.error('[Circuit Breaker] Circuit OPEN (half-open attempt failed)');
    } else if (this.failures >= this.config.failureThreshold) {
      this.state = CircuitState.OPEN;
      this.logger.error(`[Circuit Breaker] Circuit OPEN (${this.failures} failures)`);
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.halfOpenAttempts = 0;
    this.lastFailureTime = 0;
  }
}
