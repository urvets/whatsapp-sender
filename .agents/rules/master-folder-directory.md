---
trigger: always_on
---

src/
├── core/                           # Pure TS, zero framework/database dependencies
│   ├── constants/                  # App-wide magic strings or global enums
│   ├── helpers/                    # Shared pure functions (e.g., date-formatter.ts)
│   ├── interfaces/                 # Single-source-of-truth system boundaries
│   │   └── models/                 # Broadwide, global domain interfaces (e.g., user.interface.ts)
│   └── utils/                      # Low-level utilities (e.g., crypto.ts, hashing)
│
├── common/                         # NestJS-specific shared building blocks
│   ├── decorators/                 # Custom decorators (e.g., @CurrentUser(), @Public())
│   ├── filters/                    # Custom exception handlers (e.g., http-exception.filter.ts)
│   ├── guards/                     # Authentication & authorization (e.g., jwt-auth.guard.ts)
│   ├── interceptors/               # Request/response mutation (e.g., logging.interceptor.ts)
│   └── middlewares/                # Express/Fastify raw middlewares
│
├── app/                            # Global orchestration and framework configuration
│   ├── config/                     # Environment configuration blueprints (e.g., database.config.ts)
│   ├── app.controller.ts           # App health-check and root utility routes
│   └── app.module.ts               # Core root module importing all feature modules
│
└── modules/                        # Feature-Driven API Modules (Screaming Architecture)
    └── [feature_name]/             # Isolated context block (e.g., "tickets" or "orders")
        ├── domain/                 # Core Business Rules (ZERO NestJS or ORM imports)
        │   ├── entities/           # Pure business logic objects
        │   ├── interfaces/         # Context-specific interfaces (e.g., user-ticket.interface.ts)
        │   ├── exceptions/         # Feature-specific domain errors
        │   └── repositories/       # INVERSION PORTS: Repository interface definitions
        │
        ├── application/            # Orchestrates workflows (Can use NestJS @Injectable())
        │   ├── commands/           # Mutation handlers (Write logic)
        │   ├── queries/            # Retrieval handlers (Read logic)
        │   └── services/           # Services coordinating domain execution
        │
        ├── infrastructure/         # External Outbound Adapters
        │   ├── database/           # ORM entities, schemas, and repository implementations
        │   └── external-services/  # Third-party wrappers (e.g., stripe.service.ts)
        │
        ├── presentation/           # Inbound Adapters (HTTP / Transport Layer)
        │   ├── controllers/        # NestJS routing controllers
        │   └── dto/                # Request validation schemas (via class-validator)
        │
        └── [feature_name].module.ts # NestJS Module wiring up local DI bindings