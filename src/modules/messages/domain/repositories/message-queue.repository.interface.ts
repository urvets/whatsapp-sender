import { IQueueItem } from '../../../../core/interfaces/models/queue-item.interface';

export interface IMessageQueueRepository {
  getQueue(): IQueueItem[];
  getPaginatedQueue(limit: number, page: number, search?: string): { queue: IQueueItem[]; total: number };
  addToQueue(phone: string, message: string, clinicId?: string): string;
  deleteFromQueue(id: string): void;
  incrementAttempts(id: string, error: string): void;
  clearQueue(): void;
}
