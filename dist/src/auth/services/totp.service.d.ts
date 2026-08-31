export declare class TotpService {
    createSecret(): string;
    buildOtpAuthUri(email: string, secret: string): string;
    buildQrDataUrl(otpauthUri: string): Promise<string>;
    verifyToken(secret: string, token: string): boolean;
    generateToken(secret: string): string;
    generateRecoveryCodes(): string[];
    hashRecoveryCodes(codes: string[]): string[];
    consumeRecoveryCode(hashedCodes: string[] | null | undefined, presented: string): string[] | null;
    normalizeRecoveryCode(code: string): string;
}
