---
trigger: always_on
---

If a specific module needs a restricted slice or sub-selection of a broadwide entity, it should stay within that module's domain/interfaces/ subfolder. Use TypeScript utility types to derive them directly to enforce safety if the core models update.

example:
// src/modules/tickets/domain/interfaces/user-ticket.interface.ts
import { IUser } from '@/core/interfaces/models/user.interface';

// Pick only contextually necessary properties for the ticket system
export type IUserTicket = Pick<IUser, 'id' | 'email' | 'firstName'>;
