import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

export interface Config {
  apiKey: string | null;
  apiPort: number;
  frontendPort: number;
  queueDelayMs: number;
  apiUrl: string | null;
}

export const config: Config = {
  apiKey: process.env.API_KEY || null,
  apiPort: parseInt(process.env.API_PORT || '3000', 10),
  frontendPort: parseInt(process.env.FRONTEND_PORT || '3001', 10),
  queueDelayMs: parseInt(process.env.QUEUE_DELAY_MS || '5000', 10),
  apiUrl: process.env.API_URL || null,
};
