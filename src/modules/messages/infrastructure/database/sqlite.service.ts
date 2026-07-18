import { Injectable, OnModuleInit } from '@nestjs/common';
import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class SqliteService implements OnModuleInit {
  private readonly dbPath = path.join('auth_info', 'message_logs.sqlite');
  private dbInstance!: Database.Database;

  onModuleInit() {
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
      this.dbInstance = new Database(this.dbPath);
      this.dbInstance.pragma('journal_mode = WAL');
      
      this.dbInstance.prepare(`
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

      this.dbInstance.prepare(`
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

      try {
        this.dbInstance.prepare(`ALTER TABLE message_logs ADD COLUMN sender TEXT`).run();
      } catch (e) {}
      try {
        this.dbInstance.prepare(`ALTER TABLE message_queue ADD COLUMN sender TEXT`).run();
      } catch (e) {}

      this.dbInstance.prepare(`CREATE INDEX IF NOT EXISTS idx_logs_clinicId ON message_logs(clinicId)`).run();
      this.dbInstance.prepare(`CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON message_logs(timestamp)`).run();
      this.dbInstance.prepare(`CREATE INDEX IF NOT EXISTS idx_logs_status ON message_logs(status)`).run();
      this.dbInstance.prepare(`CREATE INDEX IF NOT EXISTS idx_queue_timestamp ON message_queue(timestamp)`).run();
    } catch (err) {
      console.error('Failed to initialize SQLite database:', err);
    }
  }

  get db(): Database.Database {
    return this.dbInstance;
  }
}
