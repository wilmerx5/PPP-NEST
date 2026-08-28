import { Injectable } from '@nestjs/common';
import { generateSecret, generateSync, generateURI, verifySync } from 'otplib';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import * as QRCode from 'qrcode';

const ISSUER = 'PPP Staff';
const RECOVERY_CODE_COUNT = 8;

@Injectable()
export class TotpService {
  createSecret(): string {
    return generateSecret();
  }

  buildOtpAuthUri(email: string, secret: string): string {
    return generateURI({
      issuer: ISSUER,
      label: email,
      secret,
    });
  }

  async buildQrDataUrl(otpauthUri: string): Promise<string> {
    return QRCode.toDataURL(otpauthUri, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 220,
    });
  }

  verifyToken(secret: string, token: string): boolean {
    const code = (token || '').replace(/\s/g, '');
    if (!/^\d{6}$/.test(code)) return false;
    const result = verifySync({ secret, token: code });
    return Boolean(result?.valid);
  }

  /** For tests / debugging only */
  generateToken(secret: string): string {
    return generateSync({ secret });
  }

  generateRecoveryCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < RECOVERY_CODE_COUNT; i++) {
      const raw = crypto.randomBytes(5).toString('hex').toUpperCase();
      codes.push(`${raw.slice(0, 5)}-${raw.slice(5)}`);
    }
    return codes;
  }

  hashRecoveryCodes(codes: string[]): string[] {
    return codes.map((c) => bcrypt.hashSync(this.normalizeRecoveryCode(c), 10));
  }

  consumeRecoveryCode(
    hashedCodes: string[] | null | undefined,
    presented: string,
  ): string[] | null {
    if (!hashedCodes?.length) return null;
    const normalized = this.normalizeRecoveryCode(presented);
    if (normalized.length < 8) return null;

    const idx = hashedCodes.findIndex((hash) => bcrypt.compareSync(normalized, hash));
    if (idx < 0) return null;

    return hashedCodes.filter((_, i) => i !== idx);
  }

  normalizeRecoveryCode(code: string): string {
    return (code || '').replace(/[\s-]/g, '').toUpperCase();
  }
}
