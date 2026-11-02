import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, MoreThanOrEqual } from 'typeorm';
import { createHash } from 'crypto';
import { BoldEvent, BoldReceipt } from './entities/bold-receipt.entity';
import {
  nextBoldStatus,
  parseBoldEvent,
  verifyBoldSignature,
} from './bold-event';
import { ClaimBoldDto } from './bold.dto';
import { User } from '../auth/entities/user.entity';
import { Order } from '../orders/entities/order.entity';

@Injectable()
export class BoldService {
  constructor(
    private readonly db: DataSource,
    private readonly config: ConfigService,
  ) {}
  private setting(key: string) {
    return this.config.get<string>(key)?.trim() || '';
  }
  configuration() {
    const qr = this.setting('BOLD_STATIC_QR_IMAGE_URL');
    return {
      configured: Boolean(
        this.setting('BOLD_WEBHOOK_SECRET') && this.setting('BOLD_MERCHANT_ID'),
      ),
      qrVerified: this.setting('BOLD_STATIC_QR_VERIFIED') === 'true',
      qrImageUrl: /^https:\/\//.test(qr) ? qr : null,
    };
  }
  async receive(raw: Buffer, signature?: string) {
    const secret = this.setting('BOLD_WEBHOOK_SECRET');
    const merchant = this.setting('BOLD_MERCHANT_ID');
    if (!secret || !merchant)
      throw new ServiceUnavailableException('Bold no configurado');
    if (!verifyBoldSignature(raw, signature, secret))
      throw new UnauthorizedException('Firma Bold inválida');
    const event = parseBoldEvent(raw, merchant);
    const bodyHash = createHash('sha256').update(raw).digest('hex');
    try {
      return await this.db.transaction(async (manager) => {
        // Insert event and receipt together: an ACK always means durable storage.
        const events = manager.getRepository(BoldEvent);
        const prior = await events.findOneBy({ eventId: event.eventId });
        if (prior) {
          if (prior.bodyHash !== bodyHash)
            throw new ConflictException('Evento Bold modificado');
          return { ok: true, duplicate: true };
        }
        await events.insert({
          eventId: event.eventId,
          paymentId: event.paymentId,
          type: event.type,
          bodyHash,
        });
        if (event.type === 'VOID_REJECTED') return { ok: true };
        const rows = manager.getRepository(BoldReceipt);
        // Atomic INSERT IGNORE establishes one lockable row even for simultaneous first events.
        await rows
          .createQueryBuilder()
          .insert()
          .values({
            paymentId: event.paymentId,
            merchantId: event.merchantId,
            amount: event.amount,
            currency: event.currency,
            status: nextBoldStatus(undefined, event.type),
            method: event.method,
            paidAt: event.paidAt,
            payerEmail: event.payerEmail,
            payerName: event.payerName,
          })
          .orIgnore()
          .execute();
        const row = await rows.findOne({
          where: { paymentId: event.paymentId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!row)
          throw new ServiceUnavailableException('No se pudo registrar el pago');
        if (
          row.merchantId !== merchant ||
          Number(row.amount) !== Number(event.amount) ||
          row.currency !== event.currency
        )
          throw new ConflictException('Datos de pago inconsistentes');
        row.status = nextBoldStatus(row.status, event.type);
        await rows.save(row);
        return { ok: true };
      });
    } catch (err) {
      if (
        (err as any)?.code === 'ER_DUP_ENTRY' ||
        (err as any)?.driverError?.code === 'ER_DUP_ENTRY'
      ) {
        const prior = await this.db
          .getRepository(BoldEvent)
          .findOneBy({ eventId: event.eventId });
        if (prior?.bodyHash === bodyHash) return { ok: true, duplicate: true };
      }
      throw err;
    }
  }
  async list() {
    const items = await this.db.getRepository(BoldReceipt).find({
      where: {
        merchantId: this.setting('BOLD_MERCHANT_ID'),
        receivedAt: MoreThanOrEqual(new Date(Date.now() - 7 * 86400000)),
      },
      order: { paidAt: 'DESC', id: 'DESC' },
      take: 300,
    });
    return {
      ...this.configuration(),
      serverTime: new Date().toISOString(),
      items,
    };
  }
  async claim(id: string, dto: ClaimBoldDto, actor: User) {
    try {
      return await this.db.transaction(async (manager) => {
        const rows = manager.getRepository(BoldReceipt);
        const row = await rows.findOne({
          where: { id },
          lock: { mode: 'pessimistic_write' },
        });
        if (!row) throw new NotFoundException('Pago no encontrado');
        if (row.merchantId !== this.setting('BOLD_MERCHANT_ID'))
          throw new ConflictException('El pago pertenece a otra cuenta Bold');
        if (
          !this.configuration().qrVerified &&
          row.confirmationSource !== 'online_api'
        )
          throw new ConflictException(
            'Falta validar el QR fijo; este recibo aún no tiene confirmación por API online',
          );
        if (row.status !== 'approved')
          throw new ConflictException('El pago no está aprobado');
        if (row.claimedBy)
          throw new ConflictException('Este pago ya fue utilizado');
        const order = await manager.getRepository(Order).findOne({
          where: { id: dto.orderId },
          lock: { mode: 'pessimistic_write' },
        });
        if (
          !order ||
          order.orderType !== 'delivery' ||
          order.orderStatus === 'canceled'
        )
          throw new BadRequestException(
            'Usa el ID de un pedido de domicilio vigente',
          );
        if (dto.advanceAmount > Number(row.amount))
          throw new BadRequestException('El adelanto supera el pago recibido');
        row.claimedBy = actor.id;
        row.claimedByName = actor.fullName.slice(0, 160);
        row.claimedAt = new Date();
        row.orderId = dto.orderId;
        row.advanceAmount = dto.advanceAmount.toFixed(2);
        return rows.save(row);
      });
    } catch (err) {
      if (
        (err as any)?.code === 'ER_DUP_ENTRY' ||
        (err as any)?.driverError?.code === 'ER_DUP_ENTRY'
      )
        throw new ConflictException('El pedido ya tiene un pago asociado');
      throw err;
    }
  }
  async returnAdvance(id: string, actor: User) {
    return this.db.transaction(async (manager) => {
      const rows = manager.getRepository(BoldReceipt);
      const row = await rows.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!row) throw new NotFoundException('Pago no encontrado');
      if (row.status !== 'approved' || !row.claimedBy || !row.advanceAmount)
        throw new ConflictException(
          'Pago no disponible para devolver adelanto',
        );
      if (row.returnedAt)
        throw new ConflictException('El adelanto ya fue devuelto');
      row.returnedBy = actor.id;
      row.returnedByName = actor.fullName.slice(0, 160);
      row.returnedAt = new Date();
      return rows.save(row);
    });
  }
}
