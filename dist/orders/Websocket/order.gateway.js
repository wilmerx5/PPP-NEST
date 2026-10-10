"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrdersGateway = exports.ORDER_STAFF_ROOMS = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const jwt_1 = require("@nestjs/jwt");
const jwt_strategy_1 = require("../../auth/stretegies/jwt.strategy");
const cors_allowed_1 = require("../../common/cors-allowed");
exports.ORDER_STAFF_ROOMS = ['kitchen', 'orders', 'tables'];
function isStaffRoom(room) {
    return (typeof room === 'string' &&
        exports.ORDER_STAFF_ROOMS.includes(room));
}
let OrdersGateway = class OrdersGateway {
    jwt;
    strategy;
    constructor(jwt, strategy) {
        this.jwt = jwt;
        this.strategy = strategy;
    }
    server;
    afterInit(server) {
        server.use(async (client, next) => {
            try {
                if (!(0, cors_allowed_1.isAllowedCorsOrigin)(client.handshake.headers.origin))
                    throw new Error('Untrusted origin');
                const cookie = client.handshake.headers.cookie || '';
                const value = cookie.split(';').map(part => part.trim()).find(part => part.startsWith('access_token='));
                if (!value)
                    throw new Error('Missing session');
                const token = decodeURIComponent(value.slice('access_token='.length));
                const payload = await this.jwt.verifyAsync(token);
                if (!payload.id || !Number.isFinite(payload.exp) || payload.exp * 1000 <= Date.now())
                    throw new Error('Expired session');
                const user = await this.strategy.validate(payload);
                if (!user.roles?.some(role => ['admin', 'kitchenUser', 'ordersUser', 'tableUser'].includes(role)))
                    throw new Error('Staff session required');
                client.data.orderSession = payload;
                client.data.orderUser = user;
                next();
            }
            catch {
                next(new Error('Unauthorized'));
            }
        });
    }
    handleConnection(client) {
        const exp = client.data.orderSession?.exp;
        if (!Number.isFinite(exp))
            return client.disconnect(true);
        client.data.orderExpiryTimer = setTimeout(() => client.disconnect(true), Math.max(0, exp * 1000 - Date.now()));
    }
    handleDisconnect(client) {
        clearTimeout(client.data.orderExpiryTimer);
    }
    async handleJoin(client, room) {
        if (!isStaffRoom(room))
            return;
        try {
            const payload = client.data.orderSession;
            if (!payload || payload.exp * 1000 <= Date.now())
                throw new Error('Expired session');
            const user = await this.strategy.validate(payload);
            const role = { kitchen: 'kitchenUser', orders: 'ordersUser', tables: 'tableUser' }[room];
            if (!user.roles?.includes('admin') && !user.roles?.includes(role))
                return;
            await client.join(room);
        }
        catch {
            client.disconnect(true);
        }
    }
    emitOrdersUpdates(action, order) {
        if (process.env.PPP_STAGING === 'true' && process.env.STAGING_ORDER_EVENTS_ALLOW !== 'true')
            return;
        this.server.to([...exports.ORDER_STAFF_ROOMS]).emit(action, order);
    }
};
exports.OrdersGateway = OrdersGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], OrdersGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('join_room'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, String]),
    __metadata("design:returntype", Promise)
], OrdersGateway.prototype, "handleJoin", null);
exports.OrdersGateway = OrdersGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: {
            origin: (origin, callback) => {
                if ((0, cors_allowed_1.isAllowedCorsOrigin)(origin)) {
                    return callback(null, true);
                }
                return callback(new Error('Not allowed by CORS'), false);
            },
            credentials: true,
        },
    }),
    __metadata("design:paramtypes", [jwt_1.JwtService, jwt_strategy_1.JwtStrategy])
], OrdersGateway);
//# sourceMappingURL=order.gateway.js.map