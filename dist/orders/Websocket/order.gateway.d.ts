import { Server } from 'socket.io';
import { Order } from '../entities/order.entity';
export declare class OrdersGateway {
    server: Server;
    emitOrdersUpdates(action: string, order: Order): void;
}
