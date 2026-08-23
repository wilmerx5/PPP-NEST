import { Injectable, Logger } from '@nestjs/common';

type Bucket = { timestamps: number[] };

/**
 * Rate limit en memoria por waId / teléfono.
 * Suficiente para un solo proceso Nest; en multi-instancia conviene Redis después.
 */
@Injectable()
export class WhatsappRateLimitService {
  private readonly logger = new Logger(WhatsappRateLimitService.name);
  private readonly buckets = new Map<string, Bucket>();

  /** true = permitido; false = bloqueado */
  allow(key: string, maxPerMinute: number): boolean {
    const limit = Math.max(1, Math.floor(maxPerMinute) || 25);
    const now = Date.now();
    const windowMs = 60_000;
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { timestamps: [] };
      this.buckets.set(key, bucket);
    }
    bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);
    if (bucket.timestamps.length >= limit) {
      this.logger.warn(`Rate limit hit for ${key} (${bucket.timestamps.length}/${limit}/min)`);
      return false;
    }
    bucket.timestamps.push(now);
    // Evitar crecimiento infinito de keys
    if (this.buckets.size > 5000) {
      const oldest = this.buckets.keys().next().value;
      if (oldest) this.buckets.delete(oldest);
    }
    return true;
  }
}
