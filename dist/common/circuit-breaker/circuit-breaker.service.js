"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var CircuitBreakerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CircuitBreakerService = exports.CircuitState = void 0;
const common_1 = require("@nestjs/common");
var CircuitState;
(function (CircuitState) {
    CircuitState["CLOSED"] = "CLOSED";
    CircuitState["OPEN"] = "OPEN";
    CircuitState["HALF_OPEN"] = "HALF_OPEN";
})(CircuitState || (exports.CircuitState = CircuitState = {}));
let CircuitBreakerService = CircuitBreakerService_1 = class CircuitBreakerService {
    logger = new common_1.Logger(CircuitBreakerService_1.name);
    state = CircuitState.CLOSED;
    failures = 0;
    lastFailureTime = 0;
    halfOpenAttempts = 0;
    config = {
        failureThreshold: 5,
        resetTimeout: 30000,
        halfOpenMaxAttempts: 3,
    };
    async execute(fn, fallback) {
        if (this.state === CircuitState.OPEN) {
            if (Date.now() - this.lastFailureTime > this.config.resetTimeout) {
                this.state = CircuitState.HALF_OPEN;
                this.halfOpenAttempts = 0;
                this.logger.warn('[Circuit Breaker] Moving to HALF_OPEN state');
            }
            else {
                this.logger.warn('[Circuit Breaker] Circuit OPEN, using fallback');
                if (fallback)
                    return fallback();
                throw new Error('Circuit breaker is OPEN');
            }
        }
        try {
            const result = await fn();
            this.onSuccess();
            return result;
        }
        catch (err) {
            this.onFailure();
            if (fallback) {
                this.logger.warn(`[Circuit Breaker] Operation failed, using fallback: ${err.message}`);
                return fallback();
            }
            throw err;
        }
    }
    onSuccess() {
        this.failures = 0;
        if (this.state === CircuitState.HALF_OPEN) {
            this.halfOpenAttempts++;
            if (this.halfOpenAttempts >= this.config.halfOpenMaxAttempts) {
                this.state = CircuitState.CLOSED;
                this.halfOpenAttempts = 0;
                this.logger.log('[Circuit Breaker] Circuit CLOSED (recovered)');
            }
        }
        else {
            this.state = CircuitState.CLOSED;
        }
    }
    onFailure() {
        this.failures++;
        this.lastFailureTime = Date.now();
        if (this.state === CircuitState.HALF_OPEN) {
            this.state = CircuitState.OPEN;
            this.halfOpenAttempts = 0;
            this.logger.error('[Circuit Breaker] Circuit OPEN (half-open attempt failed)');
        }
        else if (this.failures >= this.config.failureThreshold) {
            this.state = CircuitState.OPEN;
            this.logger.error(`[Circuit Breaker] Circuit OPEN (${this.failures} failures)`);
        }
    }
    getState() {
        return this.state;
    }
    reset() {
        this.state = CircuitState.CLOSED;
        this.failures = 0;
        this.halfOpenAttempts = 0;
        this.lastFailureTime = 0;
    }
};
exports.CircuitBreakerService = CircuitBreakerService;
exports.CircuitBreakerService = CircuitBreakerService = CircuitBreakerService_1 = __decorate([
    (0, common_1.Injectable)()
], CircuitBreakerService);
//# sourceMappingURL=circuit-breaker.service.js.map