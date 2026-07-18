---
trigger: always_on
---

# GET List APIs: Pagination & Search Standards

All GET endpoints in NestJS controllers that return a list of items must support query-based pagination and search functionality. This ensures consistent API design, optimized query performance, and front-end compatibility.

## 1. Controller Signature Standards
Every GET endpoint returning a list must:
1. Accept `@Query('page')` (string or number, defaulting to `'1'`).
2. Accept `@Query('limit')` (string or number, defaulting to `'20'`).
3. Accept `@Query('search')` (string, optional) to support client-side searching.
4. Pass these parsed parameters down to the corresponding application service and database repository.

### Example Controller Method:
```typescript
import { KeepRawResponse } from '@/common/decorators/keep-raw-response.decorator';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';

@Get()
@KeepRawResponse()
@ApiOperation({ summary: 'List items with pagination and search' })
@ApiOkResponse({ type: PaginatedItemsResponseDto })
async findAll(
  @CurrentUser('clinicId') clinicId: string,
  @Query('page') page = '1',
  @Query('limit') limit = '20',
  @Query('search') search?: string,
): Promise<PaginatedItemsResponseDto> {
  const result = await this.itemsService.findAll(clinicId, {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    search,
  });

  return {
    status: true,
    data: result.data.map(item => ItemResponseDto.from(item)),
    metadata: {
      totalData: result.total,
      totalPage: Math.ceil(result.total / result.limit),
      page: result.page,
      limit: result.limit,
    },
  };
}
```

---

## 2. DTO & Response Payload Standards
- Return a dedicated paginated DTO (e.g. `PaginatedItemsResponseDto`) containing the `status: true` flag, the `data` array of results, and the `metadata` pagination metadata object.
- **Never** return raw array types (e.g. `ItemResponseDto[]`) directly for listing endpoints; always wrap them in the pagination and metadata envelope.
- Because the global `ResponseInterceptor` wraps standard responses under `{ success: true, data: T }`, paginated endpoints must be decorated with `@KeepRawResponse()` to return this flat structure directly and prevent double wrapping.
- The return payload structure is:
  ```json
  {
    "status": true,
    "data": [
      { "id": "123", "name": "Item A" }
    ],
    "metadata": {
      "totalData": 100,
      "totalPage": 5,
      "page": 1,
      "limit": 20
    }
  }
  ```

---

## 3. Database Layer Implementation (Prisma)
In the repository layer, implement pagination using Prisma's `skip` and `take`, and search using matching search conditions (e.g., `contains` with `mode: 'insensitive'`).

### Example Repository Method:
```typescript
async findAll(
  clinicId: string,
  params: { page: number; limit: number; search?: string }
): Promise<{ data: IItem[]; total: number; page: number; limit: number }> {
  const { page, limit, search } = params;
  const skip = (page - 1) * limit;

  const where: Prisma.ItemWhereInput = {
    clinicId,
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    this.prisma.item.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    this.prisma.item.count({ where }),
  ]);

  return {
    data: data.map(this.mapItem),
    total,
    page,
    limit,
  };
}
```
