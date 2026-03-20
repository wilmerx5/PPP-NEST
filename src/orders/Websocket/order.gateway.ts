import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { isAllowedCorsOrigin } from '../../common/cors-allowed';

@WebSocketGateway({
  cors: {
    origin: (origin, callback) => {
      if (isAllowedCorsOrigin(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'), false);
    },

    credentials: false,
  },
})
export class OrdersGateway {
  @WebSocketServer()
  server: Server;

  @SubscribeMessage('join_room')
  handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() room: string,
  ) {
    client.join(room);
  }

  emitOrdersUpdates(action: string, order: any) {
    this.server.emit(action, order); // aun envia a todos
  }
}
