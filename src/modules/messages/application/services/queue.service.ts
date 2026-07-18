import { Injectable, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { IMessageQueueRepository } from '../../domain/repositories/message-queue.repository.interface';
import { IMessageLogRepository } from '../../domain/repositories/message-log.repository.interface';
import { IWhatsAppRepository } from '../../../whatsapp/domain/repositories/whatsapp.repository.interface';
import { ConfigService } from '../../../../app/config/config.service';

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private isProcessing = false;
  private timer: NodeJS.Timeout | null = null;
  private delayMs: number;

  constructor(
    @Inject('IMessageQueueRepository')
    private readonly queueRepository: IMessageQueueRepository,
    @Inject('IMessageLogRepository')
    private readonly logRepository: IMessageLogRepository,
    @Inject('IWhatsAppRepository')
    private readonly whatsAppRepository: IWhatsAppRepository,
    private readonly configService: ConfigService
  ) {
    this.delayMs = this.configService.queueDelayMs;
  }

  onModuleInit() {
    this.startWorker();
  }

  onModuleDestroy() {
    this.stopWorker();
  }

  public setDelay(newDelayMs: number) {
    this.delayMs = newDelayMs;
    this.stopWorker();
    this.startWorker();
    console.log(`Queue Worker delay updated dynamically to: ${this.delayMs}ms`);
  }

  public startWorker() {
    if (this.timer) return;
    this.timer = setInterval(() => this.processNext(), this.delayMs);
    console.log(`Queue Worker started. Poll delay: ${this.delayMs}ms`);
  }

  public stopWorker() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async processNext() {
    if (this.isProcessing) return;

    const session = this.whatsAppRepository.getConnectedSession();
    if (!session) {
      return;
    }

    const queue = this.queueRepository.getQueue();
    if (queue.length === 0) return;

    const nextItem = queue[0];
    this.isProcessing = true;

    try {
      console.log(`Queue Worker: Attempting to send message to +${nextItem.phone}...`);
      const result = await this.whatsAppRepository.sendMessageFromAny(nextItem.phone, nextItem.message);
      
      this.logRepository.logMessage(
        nextItem.phone,
        nextItem.message,
        'sent',
        undefined,
        nextItem.clinicId,
        result.sender
      );
      this.queueRepository.deleteFromQueue(nextItem.id);
      console.log(`Queue Worker: Message sent successfully to +${nextItem.phone}`);
    } catch (err: any) {
      console.error(`Queue Worker: Failed to send message to +${nextItem.phone}:`, err.message);
      
      const nextAttempts = nextItem.attempts + 1;
      if (nextAttempts >= 3) {
        this.logRepository.logMessage(
          nextItem.phone,
          nextItem.message,
          'failed',
          err.message || 'Failed after 3 attempts',
          nextItem.clinicId
        );
        this.queueRepository.deleteFromQueue(nextItem.id);
        console.error(`Queue Worker: Message to +${nextItem.phone} permanently failed and removed from queue.`);
      } else {
        this.queueRepository.incrementAttempts(nextItem.id, err.message || 'Unknown error');
      }
    } finally {
      this.isProcessing = false;
    }
  }
}
