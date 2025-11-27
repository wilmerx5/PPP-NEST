import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: (origin, callback) => {

      const localApp = /\.ppp\.local(:\d+)?$/;

      const prod = /\.prontopolloportal\.com$/;

      if (!origin) {
        return callback(null, true);
      }

      if (localApp.test(origin) || prod.test(origin)) {
        return callback(null, true);
      }
      console.log("❌ Origin bloqueado por WebSocket:", origin);
      return callback(new Error("Not allowed by CORS"), false);
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
    console.log(`Cliente ${client.id} se unió a la sala ${room}`);
    client.join(room);
  }

  emitOrdersUpdates(action: string, order: any) {
    this.server.emit(action, order); // aun envia a todos
  }
}
