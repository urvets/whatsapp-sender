import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { ConfigService } from './app/config/config.service';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import express from 'express';
import path from 'path';

async function bootstrap() {
  console.log('Bootstrapping WhatsApp NestJS API Gateway...');
  
  const app = await NestFactory.create(AppModule);
  
  const configService = app.get(ConfigService);

  // Register global interceptors and filters
  const reflector = app.get(Reflector);
  app.useGlobalInterceptors(new ResponseInterceptor(reflector));
  app.useGlobalFilters(new HttpExceptionFilter());

  app.enableCors({
    origin: '*',
    methods: 'GET,POST,OPTIONS,DELETE',
    allowedHeaders: 'Origin,X-Requested-With,Content-Type,Accept,x-api-key'
  });

  if (configService.apiPort === configService.frontendPort) {
    app.use(express.static(path.join(__dirname, '../public')));
    console.log('Serving frontend static files on the API Server port');
  } else {
    const frontendApp = express();
    frontendApp.get('/config.js', (req, res) => {
      res.type('application/javascript');
      res.send(`
        window.API_BASE = "${configService.apiUrl || ''}";
        window.API_KEY = "${configService.apiKey || ''}";
      `);
    });
    frontendApp.use(express.static(path.join(__dirname, '../public')));
    frontendApp.listen(configService.frontendPort, () => {
      console.log(`Frontend Server running on port ${configService.frontendPort}`);
    });
  }

  await app.listen(configService.apiPort);
  console.log(`API Server running on port ${configService.apiPort}`);
}

bootstrap().catch((err) => {
  console.error('Fatal bootstrap error:', err);
  process.exit(1);
});
