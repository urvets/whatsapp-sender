import { Controller, Get, Post, UseGuards, Res } from '@nestjs/common';
import { Response } from 'express';
import * as crypto from 'crypto';
import { ConfigService } from './config/config.service';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { KeepRawResponse } from '../common/decorators/keep-raw-response.decorator';

@Controller()
export class AppController {
  constructor(private readonly configService: ConfigService) {}

  @Get('api/auth-status')
  @KeepRawResponse()
  getAuthStatus() {
    return { authRequired: this.configService.apiKey !== null };
  }

  @Post('api/key/regenerate')
  @UseGuards(ApiKeyGuard)
  @KeepRawResponse()
  regenerateKey() {
    const newKey = crypto.randomBytes(24).toString('hex');
    this.configService.updateApiKey(newKey);
    return { success: true, apiKey: newKey };
  }

  @Get('config.js')
  @KeepRawResponse()
  getConfigJs(@Res() res: Response) {
    res.type('application/javascript');
    res.send(`
      window.API_BASE = "${this.configService.apiUrl || ''}";
      window.API_KEY = "${this.configService.apiKey || ''}";
    `);
  }
}
