import { Module } from '@nestjs/common';
import { ConfigService } from './config/config.service';
import { AppController } from './app.controller';
import { WhatsAppModule } from '../modules/whatsapp/whatsapp.module';
import { MessagesModule } from '../modules/messages/messages.module';

@Module({
  imports: [WhatsAppModule, MessagesModule],
  controllers: [AppController],
  providers: [ConfigService],
})
export class AppModule {}
