export interface IMessageLog {
  id: string;
  phone: string;
  message: string;
  timestamp: string;
  status: 'sent' | 'failed';
  error?: string;
  clinicId?: string;
  sender?: string;
}

export interface IGetLogsFilters {
  clinicId?: string;
  status?: 'sent' | 'failed';
  startDate?: string;
  endDate?: string;
  limit?: number;
  page?: number;
  search?: string;
}
