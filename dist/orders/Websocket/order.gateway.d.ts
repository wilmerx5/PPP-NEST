import { Server, Socket } from 'socket.io';
export declare const ORDER_STAFF_ROOMS: readonly ["kitchen", "orders", "tables"];
export type OrderStaffRoom = (typeof ORDER_STAFF_ROOMS)[number];
export declare class OrdersGateway {
    server: Server;
    handleJoin(client: Socket, room: string): void;
    emitOrdersUpdates(action: string, order: any): void;
}
