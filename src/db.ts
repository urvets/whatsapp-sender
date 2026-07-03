import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

export interface MessageLog {
  id: string;
  phone: string;
  message: string;
  timestamp: string;
  status: 'sent' | 'failed';
  error?: string;
  clinicId?: string;
  sender?: string;
}

export interface GetLogsFilters {
  clinicId?: string;
  status?: 'sent' | 'failed';
  startDate?: string;
  endDate?: string;
  limit?: number;
  page?: number;
  search?: string;
}

export class DbService {
  private readonly dbPath = path.join('auth_info', 'message_logs.sqlite');
  private db!: Database.Database;

  constructor() {
    this.ensureDbFolderExists();
    this.initDatabase();
  }

  private ensureDbFolderExists() {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch (err) {
        console.error('Failed to create db folder:', err);
      }
    }
  }

  private initDatabase() {
    try {
      this.db = new Database(this.dbPath);
      // Enable WAL journal mode for concurrent read-write safety
      this.db.pragma('journal_mode = WAL');
      
      // Create table
      this.db.prepare(`
        CREATE TABLE IF NOT EXISTS message_logs (
          id TEXT PRIMARY KEY,
          phone TEXT NOT NULL,
          message TEXT NOT NULL,
          timestamp TEXT NOT NULL,
          status TEXT NOT NULL,
          error TEXT,
          clinicId TEXT,
          sender TEXT
        )
      `).run();

      // Create message queue table
      this.db.prepare(`
        CREATE TABLE IF NOT EXISTS message_queue (
          id TEXT PRIMARY KEY,
          phone TEXT NOT NULL,
          message TEXT NOT NULL,
          clinicId TEXT,
          timestamp TEXT NOT NULL,
          attempts INTEGER DEFAULT 0,
          error TEXT,
          sender TEXT
        )
      `).run();

      // Run migrations for existing databases
      try {
        this.db.prepare(`ALTER TABLE message_logs ADD COLUMN sender TEXT`).run();
      } catch (e) {}
      try {
        this.db.prepare(`ALTER TABLE message_queue ADD COLUMN sender TEXT`).run();
      } catch (e) {}

      // Create indexes for efficient filtering
      this.db.prepare(`CREATE INDEX IF NOT EXISTS idx_logs_clinicId ON message_logs(clinicId)`).run();
      this.db.prepare(`CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON message_logs(timestamp)`).run();
      this.db.prepare(`CREATE INDEX IF NOT EXISTS idx_logs_status ON message_logs(status)`).run();
      this.db.prepare(`CREATE INDEX IF NOT EXISTS idx_queue_timestamp ON message_queue(timestamp)`).run();
    } catch (err) {
      console.error('Failed to initialize SQLite database:', err);
    }
  }

  public getLogs(filters: GetLogsFilters = {}): { logs: MessageLog[], total: number } {
    try {
      let query = `SELECT id, phone, message, timestamp, status, error, clinicId, sender FROM message_logs`;
      let countQuery = `SELECT COUNT(*) as total FROM message_logs`;
      const conditions: string[] = [];
      const params: any[] = [];

      // Filter by Clinic ID (case-insensitive substring search)
      if (filters.clinicId) {
        conditions.push(`lower(clinicId) LIKE ?`);
        params.push(`%${filters.clinicId.trim().toLowerCase()}%`);
      }

      // Filter by Search Keyword (searches phone, clinicId, or message)
      if (filters.search) {
        conditions.push(`(lower(phone) LIKE ? OR lower(clinicId) LIKE ? OR lower(message) LIKE ?)`);
        const searchPattern = `%${filters.search.trim().toLowerCase()}%`;
        params.push(searchPattern, searchPattern, searchPattern);
      }

      // Filter by Status
      if (filters.status) {
        conditions.push(`status = ?`);
        params.push(filters.status);
      }

      // Filter by Start Date
      if (filters.startDate) {
        conditions.push(`timestamp >= ?`);
        params.push(filters.startDate);
      }

      // Filter by End Date
      if (filters.endDate) {
        conditions.push(`timestamp <= ?`);
        params.push(filters.endDate);
      }

      if (conditions.length > 0) {
        const whereClause = ` WHERE ` + conditions.join(' AND ');
        query += whereClause;
        countQuery += whereClause;
      }

      // Run total count query
      const countStmt = this.db.prepare(countQuery);
      const countResult = countStmt.get(...params) as { total: number };
      const total = countResult ? countResult.total : 0;

      // Order newest first
      query += ` ORDER BY timestamp DESC`;

      // Limit and page results
      const limitVal = filters.limit || 100;
      const pageVal = filters.page || 1;
      const offsetVal = (pageVal - 1) * limitVal;

      query += ` LIMIT ? OFFSET ?`;
      const selectParams = [...params, limitVal, offsetVal];

      const stmt = this.db.prepare(query);
      const rows = stmt.all(...selectParams) as any[];

      const logs = rows.map(row => ({
        id: row.id,
        phone: row.phone,
        message: row.message,
        timestamp: row.timestamp,
        status: row.status as 'sent' | 'failed',
        error: row.error || undefined,
        clinicId: row.clinicId || undefined,
        sender: row.sender || undefined
      }));

      return { logs, total };
    } catch (err) {
      console.error('Failed to query logs from SQLite database:', err);
      return { logs: [], total: 0 };
    }
  }

  public logMessage(phone: string, message: string, status: 'sent' | 'failed', error?: string, clinicId?: string, sender?: string): void {
    try {
      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const timestamp = new Date().toISOString();

      const stmt = this.db.prepare(`
        INSERT INTO message_logs (id, phone, message, timestamp, status, error, clinicId, sender)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(id, phone, message, timestamp, status, error || null, clinicId || null, sender || null);

      // Keep logs size bounded to 500 records
      this.db.prepare(`
        DELETE FROM message_logs WHERE id NOT IN (
          SELECT id FROM message_logs ORDER BY timestamp DESC LIMIT 500
        )
      `).run();
    } catch (err) {
      console.error('Failed to insert log message in SQLite:', err);
    }
  }

  public clearLogs(): void {
    try {
      this.db.prepare(`DELETE FROM message_logs`).run();
    } catch (err) {
      console.error('Failed to clear SQLite logs database:', err);
    }
  }

  public getQueue(): any[] {
    try {
      const stmt = this.db.prepare(`
        SELECT id, phone, message, clinicId, timestamp, attempts, error, sender 
        FROM message_queue 
        ORDER BY timestamp ASC
      `);
      return stmt.all() as any[];
    } catch (err) {
      console.error('Failed to query queue from SQLite database:', err);
      return [];
    }
  }

  public getPaginatedQueue(limit = 20, page = 1): { queue: any[], total: number } {
    try {
      const countStmt = this.db.prepare(`SELECT COUNT(*) as total FROM message_queue`);
      const countResult = countStmt.get() as { total: number };
      const total = countResult ? countResult.total : 0;

      const offsetVal = (page - 1) * limit;
      const stmt = this.db.prepare(`
        SELECT id, phone, message, clinicId, timestamp, attempts, error, sender 
        FROM message_queue 
        ORDER BY timestamp ASC
        LIMIT ? OFFSET ?
      `);
      const queue = stmt.all(limit, offsetVal) as any[];
      return { queue, total };
    } catch (err) {
      console.error('Failed to query paginated queue from SQLite database:', err);
      return { queue: [], total: 0 };
    }
  }

  public addToQueue(phone: string, message: string, clinicId?: string): string {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();
    try {
      const stmt = this.db.prepare(`
        INSERT INTO message_queue (id, phone, message, clinicId, timestamp, attempts, error, sender)
        VALUES (?, ?, ?, ?, ?, 0, NULL, NULL)
      `);
      stmt.run(id, phone, message, clinicId || null, timestamp);
      return id;
    } catch (err) {
      console.error('Failed to insert queued message in SQLite:', err);
      throw err;
    }
  }

  public deleteFromQueue(id: string): void {
    try {
      this.db.prepare(`DELETE FROM message_queue WHERE id = ?`).run(id);
    } catch (err) {
      console.error('Failed to delete queue item in SQLite:', err);
    }
  }

  public incrementAttempts(id: string, error: string): void {
    try {
      this.db.prepare(`
        UPDATE message_queue 
        SET attempts = attempts + 1, error = ? 
        WHERE id = ?
      `).run(error, id);
    } catch (err) {
      console.error('Failed to update attempts in SQLite:', err);
    }
  }

  public clearQueue(): void {
    try {
      this.db.prepare(`DELETE FROM message_queue`).run();
    } catch (err) {
      console.error('Failed to clear SQLite queue database:', err);
    }
  }
}

export const dbService = new DbService();
