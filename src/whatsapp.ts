import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  WASocket
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode';
import pino from 'pino';
import fs from 'fs';
import path from 'path';

const VALID_COUNTRY_CODES = new Set([
  '1', '7', '20', '27', '30', '31', '32', '33', '34', '36', '39', '40', '41', '43', '44', '45', '46', '47', '48', '49',
  '51', '52', '53', '54', '55', '56', '57', '58', '60', '61', '62', '63', '64', '65', '66', '81', '82', '84', '86', '90',
  '91', '92', '93', '94', '95', '98', '211', '212', '213', '216', '218', '220', '221', '222', '223', '224', '225', '226',
  '227', '228', '229', '230', '231', '232', '233', '234', '235', '236', '237', '238', '239', '240', '241', '242', '243',
  '244', '245', '246', '247', '248', '249', '250', '251', '252', '253', '254', '255', '256', '257', '258', '260', '261',
  '262', '263', '264', '265', '266', '267', '268', '269', '290', '291', '297', '298', '299', '350', '351', '352', '353',
  '354', '355', '356', '357', '358', '359', '370', '371', '372', '373', '374', '375', '376', '377', '378', '379', '380',
  '381', '382', '383', '385', '386', '387', '389', '420', '421', '423', '500', '501', '502', '503', '504', '505', '506',
  '507', '508', '509', '590', '591', '592', '593', '594', '595', '597', '598', '599', '670', '672', '673', '674', '675',
  '676', '677', '678', '679', '680', '681', '682', '683', '685', '686', '687', '688', '689', '690', '691', '692', '800',
  '808', '850', '852', '853', '855', '856', '870', '878', '880', '881', '882', '883', '886', '888', '960', '961', '962',
  '963', '964', '965', '966', '967', '968', '970', '971', '972', '973', '974', '975', '976', '977', '979', '992', '993',
  '994', '995', '996', '998'
]);

export function formatPhone(phone: string): string {
  const trimmed = phone.trim();
  if (trimmed.startsWith('+')) {
    const rest = trimmed.slice(1).replace(/\D/g, '');
    if (VALID_COUNTRY_CODES.has(rest.slice(0, 3))) return rest;
    if (VALID_COUNTRY_CODES.has(rest.slice(0, 2))) return rest;
    if (VALID_COUNTRY_CODES.has(rest.slice(0, 1))) return rest;
    // Fallback if country code was invalid
    let clean = rest;
    if (clean.startsWith('0')) {
      clean = '62' + clean.slice(1);
    } else if (clean.startsWith('8') && clean.length >= 9 && clean.length <= 13) {
      clean = '62' + clean;
    }
    return clean;
  }
  
  let clean = trimmed.replace(/\D/g, '');
  if (clean.startsWith('0')) {
    clean = '62' + clean.slice(1);
  } else if (clean.startsWith('8') && clean.length >= 9 && clean.length <= 13) {
    clean = '62' + clean;
  }
  return clean;
}

export type ConnectionState = 'connecting' | 'qr' | 'connected' | 'disconnected';

export interface DeviceSession {
  id: string;
  name: string;
  sock: WASocket | null;
  status: ConnectionState;
  qrCodeDataUrl: string | null;
  connectedNumber: string | null;
  isReconnecting: boolean;
}

export class WhatsAppService {
  private sessions = new Map<string, DeviceSession>();
  private readonly authFolder = 'auth_info';
  private readonly logger = pino({ level: 'silent' });
  private lastSessionIndex = 0;

  constructor() {
    this.loadSessions();
  }

  // Load existing sessions from directories inside auth_info on boot
  private async loadSessions() {
    try {
      if (!fs.existsSync(this.authFolder)) {
        fs.mkdirSync(this.authFolder, { recursive: true });
      }

      const files = fs.readdirSync(this.authFolder);
      const sessionDirs = files.filter(f => {
        const fullPath = path.join(this.authFolder, f);
        return f.startsWith('session_') && fs.statSync(fullPath).isDirectory();
      });

      if (sessionDirs.length === 0) {
        // Automatically create a default session on a fresh start
        const defaultId = `session_${Date.now()}`;
        console.log(`No active sessions found. Initializing default: ${defaultId}`);
        await this.initSession(defaultId);
      } else {
        console.log(`Restoring ${sessionDirs.length} active session(s)...`);
        for (const dir of sessionDirs) {
          await this.initSession(dir);
        }
      }
    } catch (err) {
      console.error('Error loading WhatsApp sessions from disk:', err);
    }
  }

  public getSessions() {
    return Array.from(this.sessions.values()).map(s => ({
      id: s.id,
      name: s.name,
      status: s.status,
      qr: s.qrCodeDataUrl,
      number: s.connectedNumber
    }));
  }

  public async initSession(id: string, name?: string) {
    // If session already exists and is initialized, stop it first
    if (this.sessions.has(id)) {
      const existing = this.sessions.get(id)!;
      if (existing.sock) {
        try {
          existing.sock.ev.removeAllListeners('connection.update');
          existing.sock.ev.removeAllListeners('creds.update');
          existing.sock.end(undefined);
        } catch (e) {}
      }
    }

    const sessionPath = path.join(this.authFolder, id);
    if (!fs.existsSync(sessionPath)) {
      fs.mkdirSync(sessionPath, { recursive: true });
    }

    // Persist or load device name
    const nameFile = path.join(sessionPath, 'name.txt');
    let resolvedName = name || '';
    if (name) {
      try { fs.writeFileSync(nameFile, name, 'utf8'); } catch (e) {}
    } else if (fs.existsSync(nameFile)) {
      try { resolvedName = fs.readFileSync(nameFile, 'utf8').trim(); } catch (e) {}
    }

    const session: DeviceSession = {
      id,
      name: resolvedName,
      sock: null,
      status: 'connecting',
      qrCodeDataUrl: null,
      connectedNumber: null,
      isReconnecting: false
    };
    this.sessions.set(id, session);

    try {
      const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
      const { version } = await fetchLatestBaileysVersion();

      const sock = makeWASocket({
        version,
        auth: state,
        logger: this.logger
      });
      session.sock = sock;

      sock.ev.on('creds.update', () => {
        if (session.sock !== sock) return;
        saveCreds();
      });

      sock.ev.on('connection.update', async (update) => {
        if (session.sock !== sock) return;
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          session.status = 'qr';
          try {
            session.qrCodeDataUrl = await qrcode.toDataURL(qr);
          } catch (err) {
            console.error(`QR generation error for session ${id}:`, err);
          }
        }

        if (connection === 'close') {
          session.status = 'connecting';
          session.qrCodeDataUrl = null;
          session.connectedNumber = null;

          const lastError = lastDisconnect?.error;
          console.error(`WhatsApp session ${id} disconnected. Error Details:`, lastError);

          const shouldReconnect =
            (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;

          if (shouldReconnect) {
            this.handleReconnect(id);
          } else {
            session.status = 'disconnected';
            console.log(`Logged out of WhatsApp session ${id}. Re-scan required.`);
          }
        } else if (connection === 'open') {
          session.status = 'connected';
          session.qrCodeDataUrl = null;
          session.connectedNumber = sock.user?.id
            ? sock.user.id.split(':')[0]
            : 'Unknown';
          console.log(`WhatsApp session ${id} connection successfully established for:`, session.connectedNumber);
        }
      });
    } catch (error) {
      console.error(`Failed to initialize session ${id}:`, error);
      this.handleReconnect(id);
    }
  }

  private handleReconnect(id: string) {
    const session = this.sessions.get(id);
    if (!session || session.isReconnecting) return;
    session.isReconnecting = true;
    console.log(`WhatsApp session ${id} connection closed. Retrying in 5 seconds...`);
    setTimeout(() => {
      // Confirm the session was not deleted during the wait
      if (!this.sessions.has(id)) return;
      this.initSession(id).catch((err) => {
        console.error(`Error during scheduled reconnect for ${id}:`, err);
        const s = this.sessions.get(id);
        if (s) {
          s.isReconnecting = false;
          this.handleReconnect(id);
        }
      });
    }, 5000);
  }

  // Round-robin load balancer to choose a connected session
  public getConnectedSession(): DeviceSession | null {
    const connected = Array.from(this.sessions.values()).filter(s => s.status === 'connected' && s.sock);
    if (connected.length === 0) return null;

    const session = connected[this.lastSessionIndex % connected.length];
    this.lastSessionIndex++;
    return session;
  }

  public async sendMessageFromAny(phone: string, message: string): Promise<{ success: boolean, sender: string }> {
    const session = this.getConnectedSession();
    if (!session || !session.sock) {
      throw new Error('WhatsApp client is not connected');
    }

    let formattedPhone = formatPhone(phone);
    if (!formattedPhone.endsWith('@s.whatsapp.net')) {
      formattedPhone = `${formattedPhone}@s.whatsapp.net`;
    }

    await Promise.race([
      session.sock.sendMessage(formattedPhone, { text: message }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Send message timeout')), 15000))
    ]);
    return { success: true, sender: session.connectedNumber || session.id };
  }

  public async removeSession(id: string): Promise<void> {
    const session = this.sessions.get(id);
    if (!session) return;

    console.log(`Purging WhatsApp session ${id}...`);

    try {
      if (session.sock) {
        await session.sock.logout();
      }
    } catch (err) {
      console.error(`Error logging out from WhatsApp socket ${id}:`, err);
    } finally {
      if (session.sock) {
        try {
          session.sock.ev.removeAllListeners('connection.update');
          session.sock.ev.removeAllListeners('creds.update');
          session.sock.end(undefined);
        } catch (e) {}
      }

      this.sessions.delete(id);

      // Force clean session credentials directory
      const sessionPath = path.join(this.authFolder, id);
      if (fs.existsSync(sessionPath)) {
        try {
          fs.rmSync(sessionPath, { recursive: true, force: true });
        } catch (dirErr) {
          console.error(`Error deleting auth_info folder for session ${id}:`, dirErr);
        }
      }
    }
  }

  public async getPairingCode(id: string, phone: string): Promise<string> {
    const session = this.sessions.get(id);
    if (!session || !session.sock) {
      throw new Error('WhatsApp session is not initialized');
    }

    if (session.status === 'connected') {
      throw new Error('WhatsApp session is already connected');
    }

    const cleanPhone = formatPhone(phone);
    if (!cleanPhone) {
      throw new Error('Invalid phone number format');
    }

    return await session.sock.requestPairingCode(cleanPhone);
  }
}

// Export a singleton instance
export const whatsAppService = new WhatsAppService();
