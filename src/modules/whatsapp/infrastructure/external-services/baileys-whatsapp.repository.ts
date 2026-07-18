import { Injectable, OnModuleInit } from '@nestjs/common';
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  WASocket,
  Browsers
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode';
import pino from 'pino';
import * as fs from 'fs';
import * as path from 'path';
import { IWhatsAppRepository } from '../../domain/repositories/whatsapp.repository.interface';
import { IDeviceSession } from '../../domain/interfaces/device-session.interface';
import { formatPhone } from '../../../../core/helpers/phone-formatter';

@Injectable()
export class BaileysWhatsAppRepository implements IWhatsAppRepository, OnModuleInit {
  private sessions = new Map<string, IDeviceSession>();
  private readonly authFolder = 'auth_info';
  private readonly logger = pino({ level: 'silent' });
  private lastSessionIndex = 0;

  async onModuleInit() {
    await this.loadSessions();
  }

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

    const nameFile = path.join(sessionPath, 'name.txt');
    let resolvedName = name || '';
    if (name) {
      try { fs.writeFileSync(nameFile, name, 'utf8'); } catch (e) {}
    } else if (fs.existsSync(nameFile)) {
      try { resolvedName = fs.readFileSync(nameFile, 'utf8').trim(); } catch (e) {}
    }

    const session: IDeviceSession = {
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
        logger: this.logger,
        browser: Browsers.macOS('Chrome'),
        syncFullHistory: false,
        markOnlineOnConnect: false,
        fireInitQueries: false
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

  public getConnectedSession(): IDeviceSession | null {
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
