import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { JwtStrategy } from '../../auth/stretegies/jwt.strategy';
export declare const ORDER_STAFF_ROOMS: readonly ["kitchen", "orders", "tables"];
export type OrderStaffRoom = (typeof ORDER_STAFF_ROOMS)[number];
export declare class OrdersGateway {
    private readonly jwt;
    private readonly strategy;
    constructor(jwt: JwtService, strategy: JwtStrategy);
    server: Server;
    afterInit(server: Server): void;
    handleConnection(client: Socket): Socket<import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, any> | undefined;
    handleDisconnect(client: Socket): void;
    handleJoin(client: Socket, room: string): Promise<void>;
    emitOrdersUpdates(action: string, order: any): void;
}
