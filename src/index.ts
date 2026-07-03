import { startServers } from './server';
import { whatsAppService } from './whatsapp';
import { queueService } from './queue';

async function bootstrap() {
  console.log('Bootstrapping WhatsApp API Gateway...');
  
  // Start the server endpoints
  startServers();
  
  // Make sure the WhatsApp service is loaded
  // It initializes immediately on import via constructor
  const sessions = whatsAppService.getSessions();
  console.log(`WhatsApp Service initialized. Active sessions count: ${sessions.length}`);

  // Ensure Queue Service is active
  console.log('Queue Service active.');
}

bootstrap().catch((err) => {
  console.error('Fatal bootstrap error:', err);
  process.exit(1);
});
