import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Query,
  UseGuards,
  Inject,
  BadRequestException
} from '@nestjs/common';
import { ApiKeyGuard } from '../../../../common/guards/api-key.guard';
import { KeepRawResponse } from '../../../../common/decorators/keep-raw-response.decorator';
import { IMessageQueueRepository } from '../../domain/repositories/message-queue.repository.interface';
import { IMessageLogRepository } from '../../domain/repositories/message-log.repository.interface';
import { QueueService } from '../../application/services/queue.service';
import { ConfigService } from '../../../../app/config/config.service';
import { SendMessageDto } from '../dto/send-message.dto';
import { RateLimitDto } from '../dto/rate-limit.dto';
import { MessageLogResponseDto, PaginatedMessageLogsResponseDto } from '../dto/message-log-response.dto';
import { QueueItemResponseDto, PaginatedQueueResponseDto } from '../dto/queue-item-response.dto';
import { formatPhone } from '../../../../core/helpers/phone-formatter';

@Controller('api')
@UseGuards(ApiKeyGuard)
export class MessagesController {
  constructor(
    @Inject('IMessageQueueRepository')
    private readonly queueRepository: IMessageQueueRepository,
    @Inject('IMessageLogRepository')
    private readonly logRepository: IMessageLogRepository,
    private readonly queueService: QueueService,
    private readonly configService: ConfigService
  ) {}

  @Post('send')
  async sendMessage(@Body() body: SendMessageDto) {
    const { phone, message, clinicId } = body;
    if (!phone || !message) {
      throw new BadRequestException('Phone and message are required');
    }
    const formattedPhone = formatPhone(phone);
    const queueId = this.queueRepository.addToQueue(formattedPhone, message, clinicId);
    return { success: true, status: 'queued', queueId, message: 'Message successfully queued for sending' };
  }

  @Get('queue')
  @KeepRawResponse()
  getQueue(
    @Query('limit') limitQuery?: string,
    @Query('page') pageQuery?: string,
    @Query('search') search?: string
  ): PaginatedQueueResponseDto {
    const limit = parseInt(limitQuery || '20', 10);
    const page = parseInt(pageQuery || '1', 10);
    
    const { queue, total } = this.queueRepository.getPaginatedQueue(limit, page, search);

    return {
      status: true,
      data: queue.map(item => QueueItemResponseDto.from(item)),
      metadata: {
        totalData: total,
        totalPage: Math.ceil(total / limit),
        page,
        limit,
      },
    };
  }

  @Delete('queue')
  async clearQueue() {
    this.queueRepository.clearQueue();
    return { success: true, message: 'Queue cleared successfully' };
  }

  @Get('config')
  getConfig() {
    return {
      queueDelaySeconds: this.configService.queueDelayMs / 1000,
    };
  }

  @Post('config/rate-limit')
  async updateRateLimit(@Body() body: RateLimitDto) {
    const { delaySeconds } = body;
    const delayNum = typeof delaySeconds === 'string' ? parseInt(delaySeconds, 10) : delaySeconds;
    if (isNaN(delayNum) || delayNum < 1 || delayNum > 60) {
      throw new BadRequestException('Valid delaySeconds (1-60) is required');
    }
    this.configService.updateQueueDelay(delayNum);
    this.queueService.setDelay(this.configService.queueDelayMs);
    return { success: true, queueDelaySeconds: delayNum };
  }

  @Get('logs')
  @KeepRawResponse()
  getLogs(
    @Query('limit') limitQuery?: string,
    @Query('page') pageQuery?: string,
    @Query('clinicId') clinicId?: string,
    @Query('status') status?: 'sent' | 'failed',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('search') search?: string
  ): PaginatedMessageLogsResponseDto {
    const limit = parseInt(limitQuery || '20', 10);
    const page = parseInt(pageQuery || '1', 10);

    const { logs, total } = this.logRepository.getLogs({
      limit,
      page,
      clinicId,
      status,
      startDate,
      endDate,
      search,
    });

    return {
      status: true,
      data: logs.map(log => MessageLogResponseDto.from(log)),
      metadata: {
        totalData: total,
        totalPage: Math.ceil(total / limit),
        page,
        limit,
      },
    };
  }
}
