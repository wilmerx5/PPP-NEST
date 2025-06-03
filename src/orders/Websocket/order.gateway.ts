import {
    WebSocketGateway,
    WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Order } from '../entities/order.entity';
  
  @WebSocketGateway({
    cors: {
      origin: '*', // puedes restringirlo a tu frontend
    },
  })
  export class OrdersGateway {
    @WebSocketServer()
    server: Server;
  
    emitOrdersUpdates(action:string, order: Order) {
      this.server.emit(action, order); 
    }
  }
  