import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MessageService } from './message.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { AuthGuard } from '../auth/auth.guard';

@UseGuards(AuthGuard)
@Controller('messages') // route = /messages
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  @Post()
  async create(
    @Headers('x-user-id') userId: string,
    @Body() dto: CreateMessageDto,
  ) {
    const m = await this.messageService.create(userId, dto);
    // Return a minimal payload suitable for the client
    return { id: m.id, status: m.status, queuedAt: m.queuedAt };
  }

  @Get(':id')
  getOne(@Headers('x-user-id') userId: string, @Param('id') id: string) {
    return this.messageService.getById(userId, id);
  }

  @Get()
  list(
    @Headers('x-user-id') userId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.messageService.list(userId, Number(page), Number(limit));
  }
}
