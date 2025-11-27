import { Server, Socket } from 'socket.io';
export declare class OrdersGateway {
    server: Server;
    handleJoin(client: Socket, room: string): void;
    emitOrdersUpdates(action: string, order: any): void;
}
