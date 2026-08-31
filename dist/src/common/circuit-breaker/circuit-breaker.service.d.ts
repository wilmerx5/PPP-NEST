export declare enum CircuitState {
    CLOSED = "CLOSED",
    OPEN = "OPEN",
    HALF_OPEN = "HALF_OPEN"
}
export declare class CircuitBreakerService {
    private readonly logger;
    private state;
    private failures;
    private lastFailureTime;
    private halfOpenAttempts;
    private readonly config;
    execute<T>(fn: () => Promise<T>, fallback?: () => Promise<T>): Promise<T>;
    private onSuccess;
    private onFailure;
    getState(): CircuitState;
    reset(): void;
}
