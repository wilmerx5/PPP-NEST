import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { WhatsappConversationService } from './whatsapp-conversation.service';

const RETENTION_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class WhatsappCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WhatsappCleanupService.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly conversations: WhatsappConversationService) {}

  onModuleInit() {
    // Arranque: esperar un poco para no competir con migraciones
    setTimeout(() => {
      void this.runPurge();
    }, 60_000);

    this.timer = setInterval(() => {
      void this.runPurge();
    }, DAY_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async runPurge() {
    try {
      const deleted = await this.conversations.purgeMessagesOlderThan(RETENTION_DAYS);
      if (deleted > 0) {
        this.logger.log(`WhatsApp: borrados ${deleted} mensajes con más de ${RETENTION_DAYS} días`);
      } else {
        this.logger.debug(`WhatsApp: sin mensajes > ${RETENTION_DAYS} días para borrar`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`WhatsApp purge falló: ${msg}`);
    }
  }
}
