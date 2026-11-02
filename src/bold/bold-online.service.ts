import {
  BadGatewayException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, MoreThanOrEqual } from 'typeorm';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from 'crypto';
import { BoldOnlineSettings, BoldQrAttempt } from './entities/bold-qr.entity';
import { BoldReceipt, BoldEvent } from './entities/bold-receipt.entity';
import {
  boldExpiry,
  boldOnlineRequest,
  safeQrImage,
} from './bold-online-client';
import { CreateBoldQrDto } from './bold-online.dto';
import { User } from '../auth/entities/user.entity';
@Injectable()
export class BoldOnlineService {
  constructor(
    private readonly db: DataSource,
    private readonly config: ConfigService,
  ) {}
  private env(name: string) {
    return this.config.get<string>(name)?.trim() || '';
  }
  private cipherKey() {
    const seed = this.env('ENCRYPTION_KEY') || this.env('JWT_SECRET');
    if (!seed)
      throw new ServiceUnavailableException(
        'Falta clave de cifrado del servidor',
      );
    return createHash('sha256').update(`bold-online-identity:${seed}`).digest();
  }
  async saveKey(key: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.cipherKey(), iv);
    const encrypted = Buffer.concat([
      cipher.update(key.trim(), 'utf8'),
      cipher.final(),
    ]);
    await this.db.getRepository(BoldOnlineSettings).save({
      id: 'production',
      identityKeyEnc: [iv, cipher.getAuthTag(), encrypted]
        .map((b) => b.toString('base64'))
        .join('.'),
    });
    return { configured: true };
  }
  private async key() {
    const row = await this.db
      .getRepository(BoldOnlineSettings)
      .findOneBy({ id: 'production' });
    if (row) {
      try {
        const [iv, tag, body] = row.identityKeyEnc
          .split('.')
          .map((s) => Buffer.from(s, 'base64'));
        const decipher = createDecipheriv('aes-256-gcm', this.cipherKey(), iv);
        decipher.setAuthTag(tag);
        return Buffer.concat([
          decipher.update(body),
          decipher.final(),
        ]).toString('utf8');
      } catch {
        throw new ServiceUnavailableException(
          'No se pudo abrir la llave guardada; vuelve a guardarla',
        );
      }
    }
    const key =
      this.env('BOLD_ONLINE_IDENTITY_KEY') || this.env('BOLD_IDENTITY_KEY');
    if (!key)
      throw new ServiceUnavailableException(
        'Guarda la llave de identidad de producción para API Pagos en línea',
      );
    return key;
  }
  async overview() {
    const configured = Boolean(
      this.env('BOLD_ONLINE_IDENTITY_KEY') ||
        this.env('BOLD_IDENTITY_KEY') ||
        (await this.db
          .getRepository(BoldOnlineSettings)
          .findOneBy({ id: 'production' })),
    );
    const attempts = await this.db.getRepository(BoldQrAttempt).find({
      where: {
        merchantId: this.env('BOLD_MERCHANT_ID'),
        createdAt: MoreThanOrEqual(new Date(Date.now() - 86400000)),
      },
      order: { createdAt: 'DESC' },
      take: 10,
    });
    return {
      configured,
      defaultDurationMinutes: 60,
      attempts: await Promise.all(attempts.map((a) => this.withWebhook(a))),
    };
  }
  async checkAccess() {
    await boldOnlineRequest(await this.key(), '/v1/payment/pse/banks');
    return {
      ok: true,
      message:
        'La API respondió. Falta comprobar la generación de QR para esta cuenta.',
    };
  }
  view(a: BoldQrAttempt) {
    return {
      id: a.id,
      reference: a.reference,
      amount: a.amount,
      status: a.status,
      transactionId: a.transactionId,
      qrImage: a.qrImage,
      expiresAt: a.expiresAt,
      intentExpiresAt: a.intentExpiresAt,
      error: a.error,
      createdAt: a.createdAt,
    };
  }
  async withWebhook(a: BoldQrAttempt) {
    const received = a.transactionId
      ? await this.db
          .getRepository(BoldEvent)
          .countBy({ paymentId: a.transactionId, type: 'SALE_APPROVED' })
      : 0;
    return { ...this.view(a), webhookReceived: received > 0 };
  }
  async create(dto: CreateBoldQrDto, actor: User) {
    const key = await this.key();
    const merchantId = this.env('BOLD_MERCHANT_ID');
    if (!merchantId || !this.env('BOLD_WEBHOOK_SECRET'))
      throw new ServiceUnavailableException(
        'Configura primero el comercio y el secreto del webhook',
      );
    const rows = this.db.getRepository(BoldQrAttempt);
    const requestKey = `${actor.id}:${dto.requestId}`;
    const existing = await rows.findOneBy({ requestKey });
    if (existing) {
      if (Number(existing.amount) !== dto.amount)
        throw new ConflictException('Este intento ya tiene otro valor');
      return this.view(existing);
    }
    let a = rows.create({
      requestKey,
      reference: `PPPQR-${randomUUID()}`,
      createdBy: actor.id,
      merchantId,
      amount: dto.amount.toFixed(2),
      status: 'creating',
      intentExpiresAt: new Date(Date.now() + dto.durationMinutes * 60000),
    });
    try {
      a = await rows.save(a);
    } catch (e) {
      if ((e as any)?.driverError?.code === 'ER_DUP_ENTRY') {
        const duplicate = await rows.findOneByOrFail({ requestKey });
        if (Number(duplicate.amount) !== dto.amount)
          throw new ConflictException('Este intento ya tiene otro valor');
        return this.view(duplicate);
      }
      throw e;
    }
    try {
      const intent = await boldOnlineRequest(key, '/v1/payment-intent', {
        reference_id: a.reference,
        amount: {
          currency: 'COP',
          total_amount: dto.amount,
          tip_amount: 0,
          taxes: [],
        },
        expiration_date: a.intentExpiresAt.toISOString(),
        description: 'Prueba controlada QR domicilio',
      });
      if (
        intent.reference_id !== a.reference ||
        Number(intent.amount?.total_amount) !== dto.amount ||
        intent.amount?.currency !== 'COP'
      )
        throw new ConflictException(
          'La intención devuelta por Bold no corresponde al cobro solicitado',
        );
      if (intent.test === true || intent.is_sandbox === true)
        throw new ConflictException(
          'La llave es de pruebas. Usa una llave de producción para esta prueba real.',
        );
      const payer = {
        person_type: 'NATURAL_PERSON',
        name: dto.payerName.trim(),
        ...(dto.payerEmail ? { email: dto.payerEmail } : {}),
        ...(dto.payerPhone ? { phone: dto.payerPhone } : {}),
        ...(dto.payerDocument
          ? { document_type: 'CEDULA', document_number: dto.payerDocument }
          : {}),
      };
      const result = await boldOnlineRequest(key, '/v1/payment', {
        reference_id: a.reference,
        payer,
        payment_method: { name: 'QR', qr_format: 'PLAIN_BASE64' },
      });
      if (
        typeof result.transaction_id !== 'string' ||
        !result.transaction_id ||
        result.transaction_id.length > 100
      )
        throw new BadGatewayException(
          'Bold no devolvió identificador de transacción',
        );
      a.transactionId = result.transaction_id;
      a.qrImage = safeQrImage(result.next_actions?.qr_payload);
      a.expiresAt = new Date(
        Math.min(
          boldExpiry(result.next_actions?.expires_at).getTime(),
          a.intentExpiresAt.getTime(),
          intent.expiration_date
            ? boldExpiry(intent.expiration_date).getTime()
            : a.intentExpiresAt.getTime(),
        ),
      );
      a.status = 'running';
      await rows.save(a);
      return this.view(a);
    } catch (e) {
      a.status = 'unknown';
      a.error = (
        e instanceof Error ? e.message : 'No se pudo generar el QR'
      ).slice(0, 200);
      await rows.save(a);
      throw e;
    }
  }
  async refresh(id: string) {
    const rows = this.db.getRepository(BoldQrAttempt);
    const a = await rows.findOneBy({
      id,
      merchantId: this.env('BOLD_MERCHANT_ID'),
    });
    if (!a) throw new NotFoundException('QR no encontrado');
    if (a.transactionId) {
      const receipt = await this.db
        .getRepository(BoldReceipt)
        .findOneBy({ paymentId: a.transactionId });
      if (receipt?.status === 'voided') {
        a.status = 'voided';
        await rows.save(a);
      }
    }
    if (['paid', 'rejected', 'voided'].includes(a.status))
      return this.withWebhook(a);
    const cutoff = new Date(Date.now() - 10000);
    const lock = await rows
      .createQueryBuilder()
      .update()
      .set({ lastCheckedAt: new Date() })
      .where(
        'id = :id AND (lastCheckedAt IS NULL OR lastCheckedAt < :cutoff)',
        { id, cutoff },
      )
      .execute();
    if (!lock.affected) return this.withWebhook(a);
    const p = await boldOnlineRequest(
      await this.key(),
      `/v1/payment/${encodeURIComponent(a.reference)}`,
    );
    if (
      p.reference_id !== a.reference ||
      Number(p.amount?.total_amount) !== Number(a.amount) ||
      p.amount?.currency !== 'COP' ||
      (a.transactionId && p.transaction_id !== a.transactionId) ||
      p.test === true ||
      p.is_sandbox === true
    )
      throw new ConflictException(
        'Bold devolvió un pago que no corresponde a este QR',
      );
    if (p.status === 'APPROVED') {
      if (
        typeof p.transaction_id !== 'string' ||
        !p.transaction_id ||
        p.transaction_id.length > 100 ||
        p.payment_method !== 'QR'
      )
        throw new ConflictException('Respuesta de aprobación QR incompleta');
      const date = new Date(p.attempt_date);
      if (
        typeof p.attempt_date !== 'string' ||
        !/T.*(?:Z|[+-]\d\d:\d\d)$/.test(p.attempt_date) ||
        !Number.isFinite(date.getTime()) ||
        date.getTime() < a.createdAt.getTime() - 300000 ||
        date.getTime() > Date.now() + 300000
      )
        throw new ConflictException(
          'La aprobación no incluye una fecha válida',
        );
      await this.db.transaction(async (manager) => {
        const receipts = manager.getRepository(BoldReceipt);
        await receipts
          .createQueryBuilder()
          .insert()
          .values({
            paymentId: p.transaction_id,
            merchantId: a.merchantId,
            amount: a.amount,
            currency: 'COP',
            status: 'approved',
            method: 'QR',
            confirmationSource: 'online_api',
            paidAt: date,
            payerEmail:
              typeof p.payer?.email === 'string'
                ? p.payer.email.slice(0, 255)
                : null,
            payerName:
              typeof p.payer?.name === 'string'
                ? p.payer.name.slice(0, 160)
                : null,
          })
          .orIgnore()
          .execute();
        const receipt = await receipts.findOne({
          where: { paymentId: p.transaction_id },
          lock: { mode: 'pessimistic_write' },
        });
        if (
          !receipt ||
          receipt.status === 'voided' ||
          receipt.merchantId !== a.merchantId ||
          Number(receipt.amount) !== Number(a.amount)
        )
          throw new ConflictException(
            'El recibo está anulado o es inconsistente',
          );
        receipt.status = 'approved';
        receipt.confirmationSource = 'online_api';
        await receipts.save(receipt);
        a.status = 'paid';
        a.transactionId = p.transaction_id;
        a.error = null;
        await manager.getRepository(BoldQrAttempt).save(a);
      });
    } else if (p.status === 'REJECTED') {
      a.status = 'rejected';
      await rows.save(a);
    } else if (a.expiresAt && a.expiresAt.getTime() < Date.now()) {
      a.status = 'expired';
      await rows.save(a);
    }
    return this.withWebhook(a);
  }
}
