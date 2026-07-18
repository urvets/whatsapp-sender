---
trigger: always_on
---

Broadwide model definitions must be framework-agnostic. They are located inside `src/core/interfaces/models/`.

## Decimal/Numeric Type Standards
- Do not use `any` for model interface fields representing database numeric or `Decimal` values. Always use concrete types (e.g., `number`).
- In repository database implementations, map Prisma `Decimal` columns to `number` (using `Number(val)`) and use concrete types from `@prisma/client` for parameters rather than `any` to prevent compilation and ESLint errors.

example: 
// src/core/interfaces/models/user.interface.ts
export interface IUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'customer' | 'support';
  createdAt: Date;
  updatedAt: Date;
}