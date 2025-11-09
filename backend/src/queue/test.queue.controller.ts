// src/queue/queueTest.controller.ts
import { Body, Controller, Post } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Controller()
export class QueueTestController {
  constructor(@InjectQueue('messages') private readonly queue: Queue) {}

  @Post('queue-test')
  async addTest(@Body() payload: any) {
    const job = await this.queue.add('send', payload, {
      removeOnComplete: true,
      removeOnFail: true,
    });
    return { jobId: job.id };
  }
}
