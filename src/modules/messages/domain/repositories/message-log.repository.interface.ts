import { IMessageLog, IGetLogsFilters } from '../../../../core/interfaces/models/message-log.interface';

export interface IMessageLogRepository {
  getLogs(filters: IGetLogsFilters): { logs: IMessageLog[]; total: number };
  logMessage(
    phone: string,
    message: string,
    status: 'sent' | 'failed',
    error?: string,
    clinicId?: string,
    sender?: string
  ): void;
  clearLogs(): void;
}
