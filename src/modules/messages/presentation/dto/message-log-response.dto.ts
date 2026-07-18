import { IMessageLog } from '../../../../core/interfaces/models/message-log.interface';

export class MessageLogResponseDto {
  id!: string;
  phone!: string;
  message!: string;
  timestamp!: string;
  status!: 'sent' | 'failed';
  error?: string;
  clinicId?: string;
  sender?: string;

  static from(log: IMessageLog): MessageLogResponseDto {
    return {
      id: log.id,
      phone: log.phone,
      message: log.message,
      timestamp: log.timestamp,
      status: log.status,
      error: log.error,
      clinicId: log.clinicId,
      sender: log.sender,
    };
  }
}

export class PaginatedMessageLogsResponseDto {
  status!: boolean;
  data!: MessageLogResponseDto[];
  metadata!: {
    totalData: number;
    totalPage: number;
    page: number;
    limit: number;
  };
}
