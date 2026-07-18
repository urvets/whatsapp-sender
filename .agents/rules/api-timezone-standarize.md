# API Timezone Standardization Rule

All components within this repository must strictly adhere to the UTC timezone standard to ensure consistency across database persistence, query filtering, local development, and API responses.

## 1. Global Timezone Enforcement

The Node.js runtime timezone must be globally forced to `UTC` at the application's entrypoints. This guarantees that all built-in Date calculations and library functions operate under UTC regardless of the host operating system's local timezone.

- **Implementation**: Set `process.env.TZ = 'UTC'` as the very first line of code in entrypoint files, **before** any imports are executed.
- **Locations**:
  - `src/main.ts` (Application entrypoint)
  - `src/setup-app.ts` (Shared bootstrap used by the runtime and E2E/integration tests)

```typescript
process.env.TZ = 'UTC';
import { NestFactory } from '@nestjs/core';
// ... other imports
```

## 2. Database & Serialization Alignment

- **Database Storage**: The PostgreSQL database and Prisma ORM store all timestamps in UTC.
- **API Responses**: All `Date` fields returned in JSON API payloads are automatically serialized to ISO 8601 UTC strings (e.g., `"2026-06-25T07:10:22.000Z"`).
- **Presentation DTOs**: DTO mappings must preserve the UTC datetime format without local offset adjustments unless explicitly required by a specific localized business rule.
- **Swagger Documentation**: All date and datetime query parameters, request DTO properties, and response DTO fields decorated with Swagger decorators (`@ApiQuery`, `@ApiProperty`, `@ApiPropertyOptional`) **must** include a description clarifying the timezone behavior. The description must explicitly state: *"ISO 8601 format. If no timezone offset is specified, UTC is assumed."*

## 3. Timezone Assumptions for Inputs

For any date or datetime strings received in request parameters, headers, query parameters, or body payloads:
- **Implicit UTC Assumption**: If the input string does not contain an explicit timezone offset (e.g., `'2026-06-25'` or `'2026-06-25T14:12:45'`), the application **must** assume it is in the UTC timezone.
- **ECMAScript & Node.js Behavior**:
  - Date-only ISO strings (e.g., `'2026-06-25'`) are natively parsed as UTC by `new Date()`.
  - Datetime strings without an offset (e.g., `'2026-06-25T14:12:45'`) are parsed using the environment's timezone. Because `process.env.TZ = 'UTC'` is set globally, the Node.js runtime correctly parses these as UTC (`2026-06-25T14:12:45.000Z`).
- **Explicit Timezones**: If an input string contains an explicit offset (e.g., `'2026-06-25T14:12:45+07:00'`), standard JavaScript parsing will correctly convert it to the corresponding UTC instant.

## 4. Timezone-Independent Date Queries

When performing date range queries (e.g. daily filters, start/end boundaries), calculations must be deterministic and independent of the physical server's local clock:

1. **Date-Only Strings**: Parsing a date-only string (e.g., `2026-06-25`) via `new Date('2026-06-25')` naturally results in a UTC date object (`2026-06-25T00:00:00.000Z`).
2. **Boundary Calculations**: To query an entire day or range:
   - Map the start boundary to the beginning of the UTC day: `00:00:00.000` UTC.
   - Map the end boundary to the end of the UTC day: `23:59:59.999` UTC.
   - With `process.env.TZ = 'UTC'` set globally, standard `Date` methods (like `setHours`) behave identically to UTC-specific methods (like `setUTCHours`), ensuring absolute consistency.

### Example:
```typescript
const start = new Date(startDate);
start.setHours(0, 0, 0, 0); // Becomes 00:00:00.000 UTC

const end = new Date(endDate);
end.setHours(23, 59, 59, 999); // Becomes 23:59:59.999 UTC

const where: Prisma.VisitWhereInput = {
  visitAt: { gte: start, lte: end }
};
```

## 5. Verification Checklist
When writing or refactoring date-handling code:
- [ ] Verify that `process.env.TZ = 'UTC'` is present at the entrypoint.
- [ ] Avoid manual local timezone offset math (e.g., adding or subtracting hours based on timezone offsets) unless implementing a specific, isolated timezone translation layer.
- [ ] Ensure unit and E2E tests run and pass under the UTC timezone assumption.
