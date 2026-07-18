export interface IQueueItem {
  id: string;
  phone: string;
  message: string;
  clinicId?: string;
  timestamp: string;
  attempts: number;
  error?: string;
  sender?: string;
}
