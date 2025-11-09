import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type MessageJob = { messageId: string };

@Injectable()
@Processor('messages')
export class MessageProcessor extends WorkerHost {
  private readonly logger = new Logger(MessageProcessor.name);
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<MessageJob>): Promise<void> {
    const { messageId } = job.data || {};
    if (!messageId) {
      this.logger.error(`Job ${job.id} missing messageId`);
      return;
    }

    // SENDING
    await this.prisma.message.update({
      where: { id: messageId },
      data: { status: 'SENDING', sendingAt: new Date() },
    });

    // simulate sending (replace later with provider call)
    await new Promise((res) => setTimeout(res, 250));

    // SENT
    await this.prisma.message.update({
      where: { id: messageId },
      data: { status: 'SENT', sentAt: new Date() },
    });

    this.logger.log(`Job ${job.id} processed for message ${messageId}`);
  }
}
