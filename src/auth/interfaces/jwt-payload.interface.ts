export interface JwtPayload {
  id: string;
  /** '2fa' = login pendiente de código TOTP (token corto, sin cookies de sesión) */
  purpose?: '2fa';
}