import { Controller, Get } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Controller('health')
export class HealthController {
  constructor(
    @InjectQueue('messages')
    private readonly messagesQueue: Queue,
  ) {}

  @Get('redis')
  async redisPing() {
    const client = await this.messagesQueue.client; // BullMQ Redis connection
    const pong = await client.ping();

    return {
      redis: pong === 'PONG' ? 'up' : 'down',
    };
  }
}
