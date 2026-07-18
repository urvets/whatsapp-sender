import { WASocket } from '@whiskeysockets/baileys';

export type ConnectionState = 'connecting' | 'qr' | 'connected' | 'disconnected';

export interface IDeviceSession {
  id: string;
  name: string;
  sock: WASocket | null;
  status: ConnectionState;
  qrCodeDataUrl: string | null;
  connectedNumber: string | null;
  isReconnecting: boolean;
}
