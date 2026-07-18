import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { KEEP_RAW_RESPONSE_KEY } from '../decorators/keep-raw-response.decorator';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const keepRaw = this.reflector.getAllAndOverride<boolean>(
      KEEP_RAW_RESPONSE_KEY,
      [context.getHandler(), context.getClass()]
    );

    if (keepRaw) {
      return next.handle();
    }

    return next.handle().pipe(
      map((data) => ({
        success: true,
        data,
      }))
    );
  }
}
