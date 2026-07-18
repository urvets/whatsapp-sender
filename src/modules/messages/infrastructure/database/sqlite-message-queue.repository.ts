import { Injectable } from '@nestjs/common';
import { IMessageQueueRepository } from '../../domain/repositories/message-queue.repository.interface';
import { SqliteService } from './sqlite.service';
import { IQueueItem } from '../../../../core/interfaces/models/queue-item.interface';

@Injectable()
export class SqliteMessageQueueRepository implements IMessageQueueRepository {
  constructor(private readonly sqliteService: SqliteService) {}

  public getQueue(): IQueueItem[] {
    try {
      const db = this.sqliteService.db;
      const stmt = db.prepare(`
        SELECT id, phone, message, clinicId, timestamp, attempts, error, sender 
        FROM message_queue 
        ORDER BY timestamp ASC
      `);
      const rows = stmt.all() as any[];
      return rows.map(this.mapToQueueItem);
    } catch (err) {
      console.error('Failed to query queue from SQLite database:', err);
      return [];
    }
  }

  public getPaginatedQueue(limit = 20, page = 1, search?: string): { queue: IQueueItem[]; total: number } {
    try {
      const db = this.sqliteService.db;
      
      let query = `SELECT id, phone, message, clinicId, timestamp, attempts, error, sender FROM message_queue`;
      let countQuery = `SELECT COUNT(*) as total FROM message_queue`;
      const conditions: string[] = [];
      const params: any[] = [];

      if (search) {
        conditions.push(`(lower(phone) LIKE ? OR lower(clinicId) LIKE ? OR lower(message) LIKE ?)`);
        const searchPattern = `%${search.trim().toLowerCase()}%`;
        params.push(searchPattern, searchPattern, searchPattern);
      }

      if (conditions.length > 0) {
        const whereClause = ' WHERE ' + conditions.join(' AND ');
        query += whereClause;
        countQuery += whereClause;
      }

      const countStmt = db.prepare(countQuery);
      const countResult = countStmt.get(...params) as { total: number };
      const total = countResult ? countResult.total : 0;

      query += ` ORDER BY timestamp ASC LIMIT ? OFFSET ?`;
      const offsetVal = (page - 1) * limit;
      const selectParams = [...params, limit, offsetVal];

      const stmt = db.prepare(query);
      const rows = stmt.all(...selectParams) as any[];

      return {
        queue: rows.map(this.mapToQueueItem),
        total,
      };
    } catch (err) {
      console.error('Failed to query paginated queue from SQLite database:', err);
      return { queue: [], total: 0 };
    }
  }

  public addToQueue(phone: string, message: string, clinicId?: string): string {
    const db = this.sqliteService.db;
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();
    try {
      const stmt = db.prepare(`
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
      const db = this.sqliteService.db;
      db.prepare(`DELETE FROM message_queue WHERE id = ?`).run(id);
    } catch (err) {
      console.error('Failed to delete queue item in SQLite:', err);
    }
  }

  public incrementAttempts(id: string, error: string): void {
    try {
      const db = this.sqliteService.db;
      db.prepare(`
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
      const db = this.sqliteService.db;
      db.prepare(`DELETE FROM message_queue`).run();
    } catch (err) {
      console.error('Failed to clear SQLite queue database:', err);
    }
  }

  private mapToQueueItem(row: any): IQueueItem {
    return {
      id: row.id,
      phone: row.phone,
      message: row.message,
      clinicId: row.clinicId || undefined,
      timestamp: row.timestamp,
      attempts: row.attempts,
      error: row.error || undefined,
      sender: row.sender || undefined,
    };
  }
}
