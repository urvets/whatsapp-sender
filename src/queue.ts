import { dbService } from './db';
import { whatsAppService } from './whatsapp';
import { config } from './config';

export class QueueService {
  private isProcessing = false;
  private timer: NodeJS.Timeout | null = null;
  private delayMs: number;

  constructor() {
    this.delayMs = config.queueDelayMs;
    this.startWorker();
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

    // Check if any WhatsApp session is connected
    const session = whatsAppService.getConnectedSession();
    if (!session) {
      console.log('Queue Worker: No active/connected WhatsApp session. Skipping poll.');
      return; // Do not send if no active device is connected
    }

    // Get the oldest pending item
    const queue = dbService.getQueue();
    if (queue.length === 0) return;

    const nextItem = queue[0];
    this.isProcessing = true;

    try {
      console.log(`Queue Worker: Attempting to send message to +${nextItem.phone}...`);
      const result = await whatsAppService.sendMessageFromAny(nextItem.phone, nextItem.message);
      
      // Log as sent and remove from queue
      dbService.logMessage(nextItem.phone, nextItem.message, 'sent', undefined, nextItem.clinicId, result.sender);
      dbService.deleteFromQueue(nextItem.id);
      console.log(`Queue Worker: Message sent successfully to +${nextItem.phone}`);
    } catch (err: any) {
      console.error(`Queue Worker: Failed to send message to +${nextItem.phone}:`, err.message);
      
      const nextAttempts = nextItem.attempts + 1;
      if (nextAttempts >= 3) {
        // Log as failed and remove from queue
        dbService.logMessage(
          nextItem.phone,
          nextItem.message,
          'failed',
          err.message || 'Failed after 3 attempts',
          nextItem.clinicId
        );
        dbService.deleteFromQueue(nextItem.id);
        console.error(`Queue Worker: Message to +${nextItem.phone} permanently failed and removed from queue.`);
      } else {
        // Increment attempts
        dbService.incrementAttempts(nextItem.id, err.message || 'Unknown error');
      }
    } finally {
      this.isProcessing = false;
    }
  }
}

export const queueService = new QueueService();
