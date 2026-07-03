import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { config } from './config';
import { whatsAppService, formatPhone } from './whatsapp';
import { dbService } from './db';
import { queueService } from './queue';

function updateEnvQueueDelay(newDelaySeconds: number) {
  const envPath = path.join(process.cwd(), '.env');
  const delayMs = newDelaySeconds * 1000;
  try {
    if (fs.existsSync(envPath)) {
      let content = fs.readFileSync(envPath, 'utf8');
      if (content.includes('QUEUE_DELAY_MS=')) {
        content = content.replace(/QUEUE_DELAY_MS=.*/, `QUEUE_DELAY_MS=${delayMs}`);
      } else {
        content += `\nQUEUE_DELAY_MS=${delayMs}\n`;
      }
      fs.writeFileSync(envPath, content, 'utf8');
    } else {
      fs.writeFileSync(envPath, `QUEUE_DELAY_MS=${delayMs}\n`, 'utf8');
    }
    // Update in-memory config object
    config.queueDelayMs = delayMs;
    console.log(`Queue delay successfully updated in .env and runtime config to ${delayMs}ms.`);
  } catch (err) {
    console.error('Error writing new queue delay to .env file:', err);
    throw err;
  }
}

function updateEnvKey(newKey: string) {
  const envPath = path.join(process.cwd(), '.env');
  try {
    if (fs.existsSync(envPath)) {
      let content = fs.readFileSync(envPath, 'utf8');
      if (content.includes('API_KEY=')) {
        content = content.replace(/API_KEY=.*/, `API_KEY=${newKey}`);
      } else {
        content += `\nAPI_KEY=${newKey}\n`;
      }
      fs.writeFileSync(envPath, content, 'utf8');
    } else {
      fs.writeFileSync(envPath, `API_KEY=${newKey}\n`, 'utf8');
    }
    // Update in-memory config object
    config.apiKey = newKey;
    console.log('API Key successfully regenerated and updated in .env and runtime config.');
  } catch (err) {
    console.error('Error writing new API key to .env file:', err);
    throw err;
  }
}

export function startServers() {
  // 1. API Server App
  const apiApp = express();
  apiApp.use(express.json());

  // Enable CORS
  apiApp.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, x-api-key');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Authentication Middleware
  const requireApiKey = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (config.apiKey) {
      const clientKey = req.headers['x-api-key'];
      if (!clientKey || clientKey !== config.apiKey) {
        return res.status(401).json({ error: 'Unauthorized: Invalid or missing API Key' });
      }
    }
    next();
  };

  // Public endpoint to check if authentication is required by the gateway
  apiApp.get('/api/auth-status', (req, res) => {
    res.json({ authRequired: config.apiKey !== null });
  });

  // Authenticated List Devices
  apiApp.get('/api/devices', requireApiKey, (req, res) => {
    res.json(whatsAppService.getSessions());
  });

  // Authenticated Add New Device
  apiApp.post('/api/devices', requireApiKey, async (req, res) => {
    try {
      const id = `session_${Date.now()}`;
      const name: string | undefined = req.body?.name?.toString().trim() || undefined;
      await whatsAppService.initSession(id, name);
      res.json({ success: true, id });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to add device' });
    }
  });

  // Authenticated Remove Device
  apiApp.delete('/api/devices/:id', requireApiKey, async (req, res) => {
    const { id } = req.params;
    try {
      await whatsAppService.removeSession(id);
      res.json({ success: true, message: `Device session ${id} removed` });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to remove device session' });
    }
  });

  // Authenticated API Key Rotation
  apiApp.post('/api/key/regenerate', requireApiKey, (req, res) => {
    try {
      const newKey = crypto.randomBytes(24).toString('hex');
      updateEnvKey(newKey);
      res.json({ success: true, apiKey: newKey });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to regenerate API Key' });
    }
  });

  // Authenticated Send Message (Queues message to prevent bot detection)
  apiApp.post('/api/send', requireApiKey, async (req, res) => {
    const { phone, message, clinicId } = req.body;

    if (!phone || !message) {
      return res.status(400).json({ error: 'Phone and message are required' });
    }

    try {
      const formattedPhone = formatPhone(phone);
      const queueId = dbService.addToQueue(formattedPhone, message, clinicId);
      res.json({ success: true, status: 'queued', queueId, message: 'Message successfully queued for sending' });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to queue message' });
    }
  });

  // Authenticated Get Message Queue
  apiApp.get('/api/queue', requireApiKey, (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string || '20', 10);
      const page = parseInt(req.query.page as string || '1', 10);
      const result = dbService.getPaginatedQueue(limit, page);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to retrieve queue' });
    }
  });

  // Authenticated Clear Message Queue
  apiApp.delete('/api/queue', requireApiKey, (req, res) => {
    try {
      dbService.clearQueue();
      res.json({ success: true, message: 'Queue cleared successfully' });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to clear queue' });
    }
  });

  // Authenticated Get Config
  apiApp.get('/api/config', requireApiKey, (req, res) => {
    res.json({
      queueDelaySeconds: config.queueDelayMs / 1000
    });
  });

  // Authenticated Update Rate Limit
  apiApp.post('/api/config/rate-limit', requireApiKey, (req, res) => {
    const { delaySeconds } = req.body;
    const delayNum = parseInt(delaySeconds, 10);

    if (isNaN(delayNum) || delayNum < 1 || delayNum > 60) {
      return res.status(400).json({ error: 'Valid delaySeconds (1-60) is required' });
    }

    try {
      updateEnvQueueDelay(delayNum);
      queueService.setDelay(config.queueDelayMs);
      res.json({ success: true, queueDelaySeconds: delayNum });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to update rate limit' });
    }
  });

  // Authenticated get database logs with query filtering
  apiApp.get('/api/logs', requireApiKey, (req, res) => {
    const limit = parseInt(req.query.limit as string || '20', 10);
    const page = parseInt(req.query.page as string || '1', 10);
    const clinicId = req.query.clinicId as string;
    const status = req.query.status as 'sent' | 'failed';
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    const search = req.query.search as string;

    const result = dbService.getLogs({
      limit,
      page,
      clinicId,
      status,
      startDate,
      endDate,
      search
    });
    res.json(result);
  });


  // Authenticated Pairing Code connection request for a specific device
  apiApp.post('/api/devices/:id/pairing-code', requireApiKey, async (req, res) => {
    const { id } = req.params;
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    try {
      const code = await whatsAppService.getPairingCode(id, phone);
      res.json({ success: true, code });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to request pairing code' });
    }
  });

  // Serve API config
  apiApp.get('/config.js', (req, res) => {
    res.type('application/javascript');
    res.send(`
      window.API_BASE = "${config.apiUrl || ''}";
      window.API_KEY = "${config.apiKey || ''}";
    `);
  });

  // Serve API app
  apiApp.listen(config.apiPort, () => {
    console.log(`API Server running on port ${config.apiPort}`);
  });

  // 2. Frontend Server App
  // If API and Frontend share the same port, we serve the frontend static files on the API App.
  // Otherwise, we spin up a separate frontend server.
  if (config.apiPort === config.frontendPort) {
    apiApp.use(express.static(path.join(__dirname, '../public')));
    console.log('Serving frontend static files on the API Server port');
  } else {
    const frontendApp = express();
    frontendApp.get('/config.js', (req, res) => {
      res.type('application/javascript');
      res.send(`
        window.API_BASE = "${config.apiUrl || ''}";
        window.API_KEY = "${config.apiKey || ''}";
      `);
    });
    frontendApp.use(express.static(path.join(__dirname, '../public')));
    frontendApp.listen(config.frontendPort, () => {
      console.log(`Frontend Server running on port ${config.frontendPort}`);
    });
  }
}
