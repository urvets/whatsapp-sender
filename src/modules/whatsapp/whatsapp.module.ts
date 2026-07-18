import { Module } from '@nestjs/common';
import { DevicesController } from './presentation/controllers/devices.controller';
import { BaileysWhatsAppRepository } from './infrastructure/external-services/baileys-whatsapp.repository';
import { ConfigService } from '../../app/config/config.service';

@Module({
  controllers: [DevicesController],
  providers: [
    ConfigService,
    {
      provide: 'IWhatsAppRepository',
      useClass: BaileysWhatsAppRepository,
    },
  ],
  exports: ['IWhatsAppRepository'],
})
export class WhatsAppModule {}
