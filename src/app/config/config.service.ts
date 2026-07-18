import { Injectable } from '@nestjs/common';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

@Injectable()
export class ConfigService {
  private apiKeyVal: string | null = process.env.API_KEY || null;
  private apiPortVal = parseInt(process.env.API_PORT || '3000', 10);
  private frontendPortVal = parseInt(process.env.FRONTEND_PORT || '3001', 10);
  private queueDelayMsVal = parseInt(process.env.QUEUE_DELAY_MS || '5000', 10);
  private apiUrlVal = process.env.API_URL || null;

  get apiKey(): string | null {
    return this.apiKeyVal;
  }

  get apiPort(): number {
    return this.apiPortVal;
  }

  get frontendPort(): number {
    return this.frontendPortVal;
  }

  get queueDelayMs(): number {
    return this.queueDelayMsVal;
  }

  get apiUrl(): string | null {
    return this.apiUrlVal;
  }

  updateQueueDelay(newDelaySeconds: number): void {
    const delayMs = newDelaySeconds * 1000;
    this.updateEnv('QUEUE_DELAY_MS', delayMs.toString());
    this.queueDelayMsVal = delayMs;
  }

  updateApiKey(newKey: string): void {
    this.updateEnv('API_KEY', newKey);
    this.apiKeyVal = newKey;
  }

  private updateEnv(key: string, value: string): void {
    const envPath = path.join(process.cwd(), '.env');
    try {
      if (fs.existsSync(envPath)) {
        let content = fs.readFileSync(envPath, 'utf8');
        const regex = new RegExp(`${key}=.*`);
        if (regex.test(content)) {
          content = content.replace(regex, `${key}=${value}`);
        } else {
          content += `\n${key}=${value}\n`;
        }
        fs.writeFileSync(envPath, content, 'utf8');
      } else {
        fs.writeFileSync(envPath, `${key}=${value}\n`, 'utf8');
      }
    } catch (err) {
      console.error(`Error writing new ${key} to .env file:`, err);
      throw err;
    }
  }
}
