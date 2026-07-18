import { WASocket } from '@whiskeysockets/baileys';

export type ConnectionState = 'connecting' | 'connected' | 'disconnected';

export interface IDeviceSession {
  id: string;
  name: string;
  sock: WASocket | null;
  status: ConnectionState;
  connectedNumber: string | null;
  isReconnecting: boolean;
}
