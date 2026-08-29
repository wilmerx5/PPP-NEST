import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PointsService } from '../auth/services/points.service';
import type { WhatsappCartItem } from './types/whatsapp-session.types';
import {
  POINTS_REQUIRED_FOR_PRIZE,
  buildPointsOverviewReply,
  buildRegisterPointSteps,
  buildRedeemSteps,
  type PointsHelpContext,
} from './whatsapp-points-help';

const TWELVE_CHAR_CODE = /\b([A-Za-z0-9]{12})\b/;
/** Mismo alfabeto que genera el backend (sin 0, O, I, L, 1). */
const POINT_CODE_CHARSET = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{12}$/;

/** Palabras típicas de pedido — evita confundir "unpollofrito" con código de factura. */
const ORDER_INTENT_WORD =
  /\b(quiero|quieor|qiero|kiero|dame|ponme|pedir|ordenar|agrega|agregame|un|una|unos|unas|medio|cuarto|entero|combo|pollo|arroz|sopa|ejecutivo|frito|broaster|bandeja|bebida|gaseosa|domicilio|habitacion|habitaci[oó]n)\b/i;

@Injectable()
export class WhatsappPointsService {
  constructor(private readonly pointsService: PointsService) {}

  /**
   * Extrae un posible código de puntos/premio (12 caracteres).
   * No dispara con palabras pegadas del pedido ("unpollofrito").
   */
  extractPointCodeCandidate(text: string): string | null {
    const raw = (text || '').trim();
    if (!raw) return null;

    // Pedido pegado ("quiero unpollofrito") — nunca código de factura
    if (ORDER_INTENT_WORD.test(raw) && !this.hasPointsKeywords(raw)) {
      return null;
    }

    const bare = raw.match(/^[A-Za-z0-9]{12}$/);
    if (bare) {
      const code = bare[0].toUpperCase();
      return POINT_CODE_CHARSET.test(code) ? code : null;
    }

    const m = raw.match(TWELVE_CHAR_CODE);
    if (!m?.[1]) return null;

    const code = m[1].toUpperCase();
    if (!POINT_CODE_CHARSET.test(code)) return null;

    const hasDigit = /\d/.test(code);
    const pointsContext = this.hasPointsKeywords(raw);
    const orderContext = ORDER_INTENT_WORD.test(raw);

    // "quiero unpollofrito" → palabra de 12 letras, no es código de factura
    if (orderContext && !pointsContext && !hasDigit) return null;

    // Código embebido en frase: exigir contexto de puntos o al menos un dígito
    if (!pointsContext && !hasDigit) return null;

    return code;
  }

  /** @deprecated use extractPointCodeCandidate */
  extractTwelveCharCode(text: string): string | null {
    return this.extractPointCodeCandidate(text);
  }

  private hasPointsKeywords(text: string): boolean {
    const t = (text || '').toLowerCase();
    return (
      /\b(puntos?|premio?s?|cup[oó]n|canjear|redimir|acumular|mis\s+puntos|programa\s+de\s+puntos|factura|recibo|ticket|c[oó]digo\s+de\s+(punto|factura|premio)|registrar)\b/.test(
        t,
      ) ||
      /\b(c[oó]mo\s+(funcionan|gano|acumulo|registro|uso|redimir|canjear)\s+(los\s+)?puntos)\b/.test(t) ||
      /\b(qu[eé]\s+(son|genera)\s+(los\s+)?puntos)\b/.test(t) ||
      /\b(procedimiento|proceso|pasos?)\s+(para\s+)?(redimir|canjear|registrar|acumular)\b/.test(t) ||
      /\b(para\s+redimir|c[oó]mo\s+(puedo\s+)?redimir|quiero\s+redimir)\b/.test(t) ||
      /\b(mira|aqu[ií]|te\s+paso|ah[ií]\s+va)\s+(el\s+)?c[oó]digo\b/.test(t)
    );
  }

  isPointsTopic(text: string): boolean {
    if (this.extractPointCodeCandidate(text)) return true;
    return this.hasPointsKeywords(text);
  }

  isBalanceIntent(text: string): boolean {
    return /\b(mis\s+puntos|cu[aá]ntos\s+puntos|saldo\s+de\s+puntos|ver\s+puntos)\b/i.test(text);
  }

  isRedeemIntent(text: string): boolean {
    const t = (text || '').toLowerCase();
    return (
      /\b(redimir|canjear\s+(mis\s+)?puntos|generar\s+premio|sacar\s+premio)\b/.test(t) ||
      /\b(procedimiento|proceso|pasos?|c[oó]mo)\s+.+\bredimir\b/.test(t) ||
      /\bpara\s+redimir\b/.test(t) ||
      t === 'redimir'
    );
  }

  /** “Mira el código” sin pegar aún el código de 12 chars. */
  isAwaitingPointCodePrompt(text: string): boolean {
    const t = (text || '').trim();
    if (this.extractPointCodeCandidate(t)) return false;
    return /\b(mira|aqu[ií]|te\s+paso|ah[ií]\s+va|te\s+envio|te\s+env[ií]o)\s+(el\s+)?c[oó]digo\b/i.test(
      t,
    );
  }

  isRegisterIntent(text: string): boolean {
    const t = (text || '').toLowerCase();
    return (
      /\b(registrar(\s+(el\s+)?(punto|c[oó]digo|factura))?|registro\s+de\s+punto|c[oó]digo\s+de\s+factura)\b/.test(
        t,
      ) || (this.extractPointCodeCandidate(text) != null && /\bregistrar\b/i.test(t))
    );
  }

  isPremioApplyIntent(text: string): boolean {
    const t = (text || '').toLowerCase();
    return (
      /\b(premio|cup[oó]n|voucher|canje)\b/.test(t) &&
      (this.extractPointCodeCandidate(text) != null ||
        /\b(usar|aplicar|tengo|aplica)\b/.test(t))
    );
  }

  isRemovePremioIntent(text: string): boolean {
    return /\b(quitar|cancelar|sin|remover|borrar)\s+(el\s+)?premio\b/i.test(text);
  }

  cartHasHalfChicken(cart: WhatsappCartItem[]): boolean {
    return cart.some((c) => c.code === 2 || c.code === 5);
  }

  async getAvailablePoints(userId: string | null | undefined): Promise<number | null> {
    if (!userId) return null;
    return this.pointsService.getAvailablePoints(userId);
  }

  buildHelpContext(
    websiteUrl?: string | null,
    linkedUserName?: string | null,
    availablePoints?: number | null,
  ): PointsHelpContext {
    return { websiteUrl, linkedUserName, availablePoints };
  }

  buildOverviewMessage(ctx: PointsHelpContext): string {
    return buildPointsOverviewReply(ctx);
  }

  buildRegisterHelp(ctx: PointsHelpContext): string {
    return buildRegisterPointSteps(ctx);
  }

  buildRedeemHelp(available: number): string {
    return buildRedeemSteps(available);
  }

  async registerPointForUser(
    userId: string,
    code: string,
  ): Promise<{ ok: true; available: number } | { ok: false; message: string }> {
    try {
      await this.pointsService.registerPointByCode(userId, code.toUpperCase().trim());
      const available = await this.pointsService.getAvailablePoints(userId);
      return { ok: true, available };
    } catch (err) {
      return { ok: false, message: this.mapPointsError(err) };
    }
  }

  async redeemNinePoints(
    userId: string,
  ): Promise<
    | { ok: true; code: string; expiresAt: Date | null; availableAfter: number }
    | { ok: false; message: string }
  > {
    try {
      const redemption = await this.pointsService.redeemPointsForVoucher(userId);
      const availableAfter = await this.pointsService.getAvailablePoints(userId);
      return {
        ok: true,
        code: redemption.code,
        expiresAt: redemption.expiresAt ?? null,
        availableAfter,
      };
    } catch (err) {
      return { ok: false, message: this.mapPointsError(err) };
    }
  }

  async validatePremioCode(
    code: string,
    linkedUserId?: string | null,
  ): Promise<
    | { ok: true; code: string; expiresAt: Date | null }
    | { ok: false; message: string }
  > {
    try {
      const redemption = await this.pointsService.validateRedemptionCode(code.toUpperCase().trim());
      if (linkedUserId && redemption.userId && redemption.userId !== linkedUserId) {
        return {
          ok: false,
          message:
            'Ese premio pertenece a otra cuenta. Inicia sesión en la web con la cuenta correcta o usa el código en el local.',
        };
      }
      return {
        ok: true,
        code: redemption.code,
        expiresAt: redemption.expiresAt ?? null,
      };
    } catch (err) {
      return { ok: false, message: this.mapPointsError(err) };
    }
  }

  /** Intenta registrar código de factura (no premio). */
  async tryRegisterOnly(
    userId: string | null | undefined,
    code: string,
  ): Promise<{ handled: true; message: string } | { handled: false }> {
    if (!userId) {
      return {
        handled: true,
        message:
          'Para registrar ese código necesitas una cuenta web vinculada a este celular. ' +
          'Entra a la web → *Mis puntos* → *Registrar punto*.',
      };
    }
    const result = await this.registerPointForUser(userId, code);
    if (result.ok) {
      return {
        handled: true,
        message:
          `✅ *Punto registrado.* Ahora tienes *${result.available}* punto(s) disponible(s).\n\n` +
          (result.available >= POINTS_REQUIRED_FOR_PRIZE
            ? `Ya puedes escribir *redimir* para generar tu premio.`
            : `Te faltan *${POINTS_REQUIRED_FOR_PRIZE - result.available}* para redimir un premio.`),
      };
    }
    return { handled: true, message: result.message };
  }

  private mapPointsError(err: unknown): string {
    if (err instanceof NotFoundException) {
      const msg = err.message || '';
      if (/premio|redemption/i.test(msg)) {
        return 'Código de premio no encontrado. Revisa que sean 12 caracteres.';
      }
      return 'Código no encontrado. Verifica el código de tu factura (12 caracteres).';
    }
    if (err instanceof ConflictException) {
      const msg = (err.message || '').toLowerCase();
      if (/already been used|ya fue usado/i.test(msg)) {
        return 'Ese código ya fue usado.';
      }
      if (/otro usuario|another user/i.test(msg)) {
        return 'Ese código ya fue registrado por otro usuario.';
      }
      return err.message || 'Ese código ya no está disponible.';
    }
    if (err instanceof BadRequestException) {
      const msg = err.message || '';
      if (/expired|expir/i.test(msg)) {
        return 'Ese premio ya venció (30 días desde que lo generaste).';
      }
      if (/12 character|12 caracteres/i.test(msg)) {
        return 'El código debe tener exactamente 12 caracteres (letras y números).';
      }
      if (/at least 9|9 points|9 puntos/i.test(msg)) {
        return `Necesitas al menos ${POINTS_REQUIRED_FOR_PRIZE} puntos disponibles para redimir.`;
      }
      return msg;
    }
    if (err instanceof Error) return err.message;
    return 'No pude procesar el código. Intenta de nuevo o escribe *humano*.';
  }
}
