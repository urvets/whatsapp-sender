import { Module } from '@nestjs/common';
import { MessagesController } from './presentation/controllers/messages.controller';
import { QueueService } from './application/services/queue.service';
import { SqliteService } from './infrastructure/database/sqlite.service';
import { SqliteMessageQueueRepository } from './infrastructure/database/sqlite-message-queue.repository';
import { SqliteMessageLogRepository } from './infrastructure/database/sqlite-message-log.repository';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { ConfigService } from '../../app/config/config.service';

@Module({
  imports: [WhatsAppModule],
  controllers: [MessagesController],
  providers: [
    ConfigService,
    SqliteService,
    QueueService,
    {
      provide: 'IMessageQueueRepository',
      useClass: SqliteMessageQueueRepository,
    },
    {
      provide: 'IMessageLogRepository',
      useClass: SqliteMessageLogRepository,
    },
  ],
  exports: [QueueService],
})
export class MessagesModule {}
