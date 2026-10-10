"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsappAdminAlertService = void 0;
const common_1 = require("@nestjs/common");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
let WhatsappAdminAlertService = class WhatsappAdminAlertService {
    bus = new rxjs_1.Subject();
    notifyHumanNeeded(input) {
        this.bus.next({
            type: 'human_needed',
            conversationId: input.conversationId,
            phoneE164: input.phoneE164,
            customerName: input.customerName ?? null,
            at: new Date().toISOString(),
        });
    }
    asSse() {
        return new rxjs_1.Observable((subscriber) => {
            subscriber.next({
                type: 'connected',
                data: JSON.stringify({ type: 'connected', at: new Date().toISOString() }),
            });
            const sub = this.bus
                .pipe((0, operators_1.map)((p) => ({
                type: 'human_needed',
                data: JSON.stringify(p),
            })))
                .subscribe({
                next: (ev) => subscriber.next(ev),
                error: (err) => subscriber.error(err),
            });
            const heartbeat = setInterval(() => {
                subscriber.next({
                    type: 'ping',
                    data: JSON.stringify({ type: 'ping', at: new Date().toISOString() }),
                });
            }, 15000);
            return () => {
                clearInterval(heartbeat);
                sub.unsubscribe();
            };
        });
    }
};
exports.WhatsappAdminAlertService = WhatsappAdminAlertService;
exports.WhatsappAdminAlertService = WhatsappAdminAlertService = __decorate([
    (0, common_1.Injectable)()
], WhatsappAdminAlertService);
//# sourceMappingURL=whatsapp-admin-alert.service.js.map