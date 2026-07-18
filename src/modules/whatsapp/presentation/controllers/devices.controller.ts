import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, Inject } from '@nestjs/common';
import { ApiKeyGuard } from '../../../../common/guards/api-key.guard';
import { KeepRawResponse } from '../../../../common/decorators/keep-raw-response.decorator';
import { IWhatsAppRepository } from '../../domain/repositories/whatsapp.repository.interface';
import { AddDeviceDto } from '../dto/add-device.dto';
import { PairingCodeDto } from '../dto/pairing-code.dto';
import { DeviceResponseDto, PaginatedDevicesResponseDto } from '../dto/device-response.dto';

@Controller('api/devices')
@UseGuards(ApiKeyGuard)
export class DevicesController {
  constructor(
    @Inject('IWhatsAppRepository')
    private readonly whatsAppRepository: IWhatsAppRepository
  ) {}

  @Get()
  @KeepRawResponse()
  getDevices(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('search') search?: string
  ): PaginatedDevicesResponseDto {
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;

    const allSessions = this.whatsAppRepository.getSessions();
    let filtered = allSessions;

    if (search) {
      const s = search.toLowerCase();
      filtered = allSessions.filter(item => 
        item.id.toLowerCase().includes(s) || 
        (item.name && item.name.toLowerCase().includes(s)) ||
        (item.number && item.number.toLowerCase().includes(s))
      );
    }

    const total = filtered.length;
    const skip = (pageNum - 1) * limitNum;
    const paginatedSessions = filtered.slice(skip, skip + limitNum);

    return {
      status: true,
      data: paginatedSessions.map(session => DeviceResponseDto.from(session)),
      metadata: {
        totalData: total,
        totalPage: Math.ceil(total / limitNum),
        page: pageNum,
        limit: limitNum,
      },
    };
  }

  @Post()
  async addDevice(@Body() body: AddDeviceDto) {
    const id = `session_${Date.now()}`;
    const name = body?.name?.trim() || undefined;
    await this.whatsAppRepository.initSession(id, name);
    return { success: true, id };
  }

  @Delete(':id')
  async removeDevice(@Param('id') id: string) {
    await this.whatsAppRepository.removeSession(id);
    return { success: true, message: `Device session ${id} removed` };
  }

  @Post(':id/pairing-code')
  async getPairingCode(@Param('id') id: string, @Body() body: PairingCodeDto) {
    const code = await this.whatsAppRepository.getPairingCode(id, body.phone);
    return { success: true, code };
  }
}
