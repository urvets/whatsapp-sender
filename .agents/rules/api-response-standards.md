---
trigger: always_on
---

# API Response Standards & Strict Response Rules

All HTTP APIs built within this repository must strictly conform to standard response envelopes and error conventions to ensure consistency, type-safety, and robust error management.

## 1. Success Response Envelope

All single-object API responses are automatically wrapped in a standardized success envelope by the global `ResponseInterceptor`:

```typescript
export interface ApiResponse<T> {
  success: true;
  data: T;
}
```

### 1.1 Single-Object Responses
For requests returning a single resource, the `data` property contains the resource object itself:
```json
{
  "success": true,
  "data": {
    "id": "123",
    "name": "John Doe"
  }
}
```

### 1.2 Paginated List Responses
All APIs returning a list of items must return a paginated payload containing a `status: true` flag, a flat `data` array of items, and a sibling `metadata` pagination object:
```typescript
export interface PaginatedResponse<T> {
  status: true;
  data: T[];
  metadata: {
    totalData: number;
    totalPage: number;
    page: number;
    limit: number;
  };
}
```
Thus, the final serialized response structure for paginated lists is:
```json
{
  "status": true,
  "data": [
    { "id": "123", "name": "Item A" }
  ],
  "metadata": {
    "totalData": 1,
    "totalPage": 1,
    "page": 1,
    "limit": 20
  }
}
```

### Automatic Wrapping
- By default, all controllers returning standard JSON payloads will have their payloads wrapped under `data` by the interceptor.
- If a controller method returns a paginated list, it must use the `@KeepRawResponse()` decorator from `src/common/decorators/keep-raw-response.decorator.ts` to bypass the global `ResponseInterceptor` success wrapping and return the flat paginated layout directly.
- To explicitly exclude any other endpoint from success enveloping (e.g. for external webhook callbacks or simple flat status endpoints), use the `@KeepRawResponse()` decorator.

### Swagger Documentation
- Do NOT use raw `@ApiOkResponse({ type: MyDto })` for regular wrapped endpoints as it will document the response schema incorrectly because of the envelope.
- Instead:
  - Use `@ApiOkResponseWrapped(MyDto)` for single-object DTO responses.
  - Use raw `@ApiOkResponse({ type: PaginatedUsersDto })` for paginated list endpoints, since they bypass the interceptor wrapping using `@KeepRawResponse()` to return a flat paginated layout.
  - Use `@ApiOkResponseArrayWrapped(MyDto)` only when returning a raw array that is wrapped into `ApiResponse<MyDto[]>`.

Example (Paginated):
```typescript
import { KeepRawResponse } from '@/common/decorators/keep-raw-response.decorator';
import { ApiOkResponse } from '@nestjs/swagger';

@Get()
@KeepRawResponse()
@ApiOkResponse({ type: PaginatedUsersDto })
async findAll(
  @Query('page') page = '1',
  @Query('limit') limit = '20',
  @Query('search') search?: string,
): Promise<PaginatedUsersDto> {
  const result = await this.usersService.findAll({
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    search,
  });

  return {
    status: true,
    data: result.data.map(user => UserResponseDto.from(user)),
    metadata: {
      totalData: result.total,
      totalPage: Math.ceil(result.total / result.limit),
      page: result.page,
      limit: result.limit,
    },
  };
}
```

## 2. Error Response Envelope & Custom Error Codes

All errors thrown by the application must be mapped to a standardized error response shape by `HttpExceptionFilter`:

```typescript
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string; // Machine-readable uppercase snake_case string
    message: string; // Human-friendly error description
    details?: any; // Structured context (e.g. validation details)
  };
  timestamp: string;
  path: string;
}
```

### Standard Error Codes
Error codes must be defined in the global `ErrorCode` enum inside `src/core/constants/error-codes.ts`:
- `VALIDATION_ERROR` (Validation failed, e.g. class-validator)
- `NOT_FOUND` (Resource not found)
- `UNAUTHORIZED` (Missing/invalid auth)
- `FORBIDDEN` (Insufficient permissions)
- `CONFLICT` (Entity already exists)
- `BAD_REQUEST` (Malformed input/client request)
- `INTERNAL_SERVER_ERROR` (Unexpected runtime error)
- `DATABASE_ERROR` (Prisma/DB exception)

### Throwing Errors
- **Domain/Business Logic**: Use the pure `AppException` from `src/core/exceptions/app.exception.ts` to trigger a specific error code and HTTP status code. Do NOT throw NestJS exceptions inside `src/core` or `domain` subfolders.
- **Presentation/Controller Layer**: You can throw standard NestJS HTTP exceptions, which will automatically be mapped to standard error codes (e.g. `NotFoundException` -> `NOT_FOUND`).

Example:
```typescript
import { ErrorCode } from '@/core/constants/error-codes';
import { AppException } from '@/core/exceptions/app.exception';

// Inside domain/application layer
throw new AppException(ErrorCode.NOT_FOUND, 'User not found'); // Defaults to 404

```

## 3. Strict Presentation Layer Response Mappings
- Controllers must NEVER return raw database entities (e.g., Prisma model types) directly to the client.
- All routes must explicitly return a presentation DTO (e.g. `UserResponseDto`).
- Use TypeScript derivation or mapping functions to structure DTOs cleanly, ensuring sensitive data is never exposed.
