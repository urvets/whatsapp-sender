import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '../../app/config/config.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const apiKey = this.configService.apiKey;
    if (!apiKey) {
      return true;
    }
    const request = context.switchToHttp().getRequest();
    const clientKey = request.headers['x-api-key'];
    if (!clientKey || clientKey !== apiKey) {
      throw new UnauthorizedException('Unauthorized: Invalid or missing API Key');
    }
    return true;
  }
}
