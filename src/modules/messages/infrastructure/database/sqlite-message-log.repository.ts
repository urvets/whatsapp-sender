import { Injectable } from '@nestjs/common';
import { IMessageLogRepository } from '../../domain/repositories/message-log.repository.interface';
import { SqliteService } from './sqlite.service';
import { IMessageLog, IGetLogsFilters } from '../../../../core/interfaces/models/message-log.interface';

@Injectable()
export class SqliteMessageLogRepository implements IMessageLogRepository {
  constructor(private readonly sqliteService: SqliteService) {}

  public getLogs(filters: IGetLogsFilters = {}): { logs: IMessageLog[]; total: number } {
    try {
      const db = this.sqliteService.db;
      let query = `SELECT id, phone, message, timestamp, status, error, clinicId, sender FROM message_logs`;
      let countQuery = `SELECT COUNT(*) as total FROM message_logs`;
      const conditions: string[] = [];
      const params: any[] = [];

      if (filters.clinicId) {
        conditions.push(`lower(clinicId) LIKE ?`);
        params.push(`%${filters.clinicId.trim().toLowerCase()}%`);
      }

      if (filters.search) {
        conditions.push(`(lower(phone) LIKE ? OR lower(clinicId) LIKE ? OR lower(message) LIKE ?)`);
        const searchPattern = `%${filters.search.trim().toLowerCase()}%`;
        params.push(searchPattern, searchPattern, searchPattern);
      }

      if (filters.status) {
        conditions.push(`status = ?`);
        params.push(filters.status);
      }

      if (filters.startDate) {
        conditions.push(`timestamp >= ?`);
        params.push(filters.startDate);
      }

      if (filters.endDate) {
        conditions.push(`timestamp <= ?`);
        params.push(filters.endDate);
      }

      if (conditions.length > 0) {
        const whereClause = ` WHERE ` + conditions.join(' AND ');
        query += whereClause;
        countQuery += whereClause;
      }

      const countStmt = db.prepare(countQuery);
      const countResult = countStmt.get(...params) as { total: number };
      const total = countResult ? countResult.total : 0;

      query += ` ORDER BY timestamp DESC`;

      const limitVal = filters.limit || 100;
      const pageVal = filters.page || 1;
      const offsetVal = (pageVal - 1) * limitVal;

      query += ` LIMIT ? OFFSET ?`;
      const selectParams = [...params, limitVal, offsetVal];

      const stmt = db.prepare(query);
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

  public logMessage(
    phone: string,
    message: string,
    status: 'sent' | 'failed',
    error?: string,
    clinicId?: string,
    sender?: string
  ): void {
    try {
      const db = this.sqliteService.db;
      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const timestamp = new Date().toISOString();

      const stmt = db.prepare(`
        INSERT INTO message_logs (id, phone, message, timestamp, status, error, clinicId, sender)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(id, phone, message, timestamp, status, error || null, clinicId || null, sender || null);

      db.prepare(`
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
      const db = this.sqliteService.db;
      db.prepare(`DELETE FROM message_logs`).run();
    } catch (err) {
      console.error('Failed to clear SQLite logs database:', err);
    }
  }
}
