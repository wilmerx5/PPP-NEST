import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { isAllowedCorsOrigin } from '../../common/cors-allowed';

/** Rooms de staff. Los fronts se unen a la suya; emitimos a todas. */
export const ORDER_STAFF_ROOMS = ['kitchen', 'orders', 'tables'] as const;
export type OrderStaffRoom = (typeof ORDER_STAFF_ROOMS)[number];

function isStaffRoom(room: unknown): room is OrderStaffRoom {
  return (
    typeof room === 'string' &&
    (ORDER_STAFF_ROOMS as readonly string[]).includes(room)
  );
}

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
    if (!isStaffRoom(room)) {
      return;
    }
    client.join(room);
  }

  /**
   * Emite solo a rooms de staff (kitchen / orders / tables),
   * no a todo el namespace (evita clientes ajenos).
   * En staging queda bloqueado por defecto para que una orden sintética no
   * llegue a una cocina, impresora o app de mesas conectada por error.
   */
  emitOrdersUpdates(action: string, order: any) {
    if (
      process.env.PPP_STAGING === 'true' &&
      process.env.STAGING_ORDER_EVENTS_ALLOW !== 'true'
    ) {
      return;
    }
    this.server.to([...ORDER_STAFF_ROOMS]).emit(action, order);
  }
}
