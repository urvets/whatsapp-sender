---
trigger: always_on
---

To enforce Clean Architecture boundaries, application layers must interact with domain repository ports using custom provider token bindings in the local NestJS feature module.

example:
// src/modules/tickets/tickets.module.ts
import { Module } from '@nestjs/common';
import { TicketsController } from './presentation/controllers/tickets.controller';
import { TicketsService } from './application/services/tickets.service';
import { PrismaTicketsRepository } from './infrastructure/database/prisma-tickets.repository';

@Module({
  controllers: [TicketsController],
  providers: [
    TicketsService,
    {
      provide: 'ITicketsRepository', // Inversion Token binding
      useClass: PrismaTicketsRepository, // Concrete execution layer
    },
  ],
  exports: [TicketsService],
})
export class TicketsModule {}


// src/modules/tickets/application/services/tickets.service.ts
import { Injectable, Inject } from '@nestjs/common';
import { ITicketsRepository } from '../../domain/repositories/tickets.repository.interface';

@Injectable()
export class TicketsService {
  constructor(
    @Inject('ITicketsRepository') 
    private readonly ticketsRepository: ITicketsRepository,
  ) {}
}

