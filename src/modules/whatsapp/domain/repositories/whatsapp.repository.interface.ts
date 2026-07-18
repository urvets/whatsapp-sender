export interface IWhatsAppRepository {
  getSessions(): any[];
  initSession(id: string, name?: string): Promise<void>;
  removeSession(id: string): Promise<void>;
  getConnectedSession(): any | null;
  sendMessageFromAny(phone: string, message: string): Promise<{ success: boolean; sender: string }>;
  getPairingCode(id: string, phone: string): Promise<string>;
}
