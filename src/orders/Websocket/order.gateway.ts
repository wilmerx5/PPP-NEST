import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { JwtStrategy } from '../../auth/stretegies/jwt.strategy';
import { User } from '../../auth/entities/user.entity';
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

    credentials: true,
  },
})
export class OrdersGateway {
  constructor(private readonly jwt: JwtService, private readonly strategy: JwtStrategy) {}

  @WebSocketServer()
  server: Server;

  afterInit(server: Server) {
    server.use(async (client, next) => {
      try {
        if (!isAllowedCorsOrigin(client.handshake.headers.origin)) throw new Error('Untrusted origin');
        const cookie = client.handshake.headers.cookie || '';
        const value = cookie.split(';').map(part => part.trim()).find(part => part.startsWith('access_token='));
        if (!value) throw new Error('Missing session');
        const token = decodeURIComponent(value.slice('access_token='.length));
        const payload = await this.jwt.verifyAsync<{ id: string; exp: number; purpose?: '2fa' }>(token);
        if (!payload.id || !Number.isFinite(payload.exp) || payload.exp * 1000 <= Date.now()) throw new Error('Expired session');
        const user = await this.strategy.validate(payload);
        if (!user.roles?.some(role => ['admin', 'kitchenUser', 'ordersUser', 'tableUser'].includes(role))) throw new Error('Staff session required');
        client.data.orderSession = payload;
        client.data.orderUser = user;
        next();
      } catch {
        next(new Error('Unauthorized'));
      }
    });
  }

  handleConnection(client: Socket) {
    const exp = client.data.orderSession?.exp;
    if (!Number.isFinite(exp)) return client.disconnect(true);
    // A socket must not retain access after its HTTP session expires.
    client.data.orderExpiryTimer = setTimeout(() => client.disconnect(true), Math.max(0, exp * 1000 - Date.now()));
  }

  handleDisconnect(client: Socket) {
    clearTimeout(client.data.orderExpiryTimer);
  }

  @SubscribeMessage('join_room')
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() room: string,
  ) {
    if (!isStaffRoom(room)) return;
    try {
      const payload = client.data.orderSession;
      if (!payload || payload.exp * 1000 <= Date.now()) throw new Error('Expired session');
      const user: User = await this.strategy.validate(payload);
      const role = { kitchen: 'kitchenUser', orders: 'ordersUser', tables: 'tableUser' }[room];
      if (!user.roles?.includes('admin') && !user.roles?.includes(role)) return;
      await client.join(room);
    } catch {
      client.disconnect(true);
    }
  }

  /**
   * Emite solo a rooms de staff (kitchen / orders / tables),
   * no a todo el namespace (evita clientes ajenos).
   */
  emitOrdersUpdates(action: string, order: any) {
    if (process.env.PPP_STAGING === 'true' && process.env.STAGING_ORDER_EVENTS_ALLOW !== 'true') return;
    this.server.to([...ORDER_STAFF_ROOMS]).emit(action, order);
  }
}
