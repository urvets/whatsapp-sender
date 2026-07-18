import { IQueueItem } from '../../../../core/interfaces/models/queue-item.interface';

export class QueueItemResponseDto {
  id!: string;
  phone!: string;
  message!: string;
  clinicId?: string;
  timestamp!: string;
  attempts!: number;
  error?: string;
  sender?: string;

  static from(item: IQueueItem): QueueItemResponseDto {
    return {
      id: item.id,
      phone: item.phone,
      message: item.message,
      clinicId: item.clinicId,
      timestamp: item.timestamp,
      attempts: item.attempts,
      error: item.error,
      sender: item.sender,
    };
  }
}

export class PaginatedQueueResponseDto {
  status!: boolean;
  data!: QueueItemResponseDto[];
  metadata!: {
    totalData: number;
    totalPage: number;
    page: number;
    limit: number;
  };
}
