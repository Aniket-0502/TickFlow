import {
  Processor,
  OnWorkerEvent,
  WorkerHost,
  InjectQueue,
} from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { Queue } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

type SendPayload = { messageId: string; userId: string };
type SimplePayload = { messageId: string };

@Processor('messages')
@Injectable()
export class MessageProcessor extends WorkerHost {
  private readonly logger = new Logger(MessageProcessor.name);

  // Tunables (env overrideable)
  private readonly providerDelayMs: number;
  private readonly deliveredDelayMs: number;
  private readonly readDelayMs: number;
  private readonly failRate: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @InjectQueue('messages') private readonly queue: Queue,
  ) {
    super();

    this.providerDelayMs = Number(this.config.get('PROVIDER_DELAY_MS') ?? 500);
    this.deliveredDelayMs = Number(
      this.config.get('DELIVERED_DELAY_MS') ?? 1000,
    );
    this.readDelayMs = Number(this.config.get('READ_DELAY_MS') ?? 2000);
    this.failRate = Math.min(
      1,
      Math.max(0, Number(this.config.get('PROVIDER_FAIL_RATE') ?? 0)),
    );
  }

  /**
   * Single worker handling multiple named jobs:
   *  - 'send'       -> mark SENDING; maybe fail; mark SENT; enqueue receipts
   *  - 'delivered'  -> mark DELIVERED
   *  - 'read'       -> mark READ
   */
  async process(job: Job<any>): Promise<void> {
    switch (job.name) {
      case 'send':
        await this.handleSend(job as Job<SendPayload>);
        return;
      case 'delivered':
        await this.handleDelivered(job as Job<SimplePayload>);
        return;
      case 'read':
        await this.handleRead(job as Job<SimplePayload>);
        return;
      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
        return;
    }
  }

  private async handleSend(job: Job<SendPayload>) {
    const { messageId } = job.data;

    // Mark SENDING
    await this.prisma.message.update({
      where: { id: messageId },
      data: { status: 'SENDING', sendingAt: new Date() },
    });

    // Simulated provider latency
    await sleep(this.providerDelayMs);

    // Simulated provider failure
    if (Math.random() < this.failRate) {
      // Throw so BullMQ retries according to queue options.
      throw new Error('Simulated provider failure');
    }

    // Mark SENT
    await this.prisma.message.update({
      where: { id: messageId },
      data: { status: 'SENT', sentAt: new Date() },
    });
    this.logger.log(`Message ${messageId} marked SENT`);

    // Enqueue follow-up receipts via the injected queue (NOT job.queue)
    await this.queue.add(
      'delivered',
      { messageId },
      { delay: this.deliveredDelayMs },
    );
    await this.queue.add(
      'read',
      { messageId },
      { delay: this.deliveredDelayMs + this.readDelayMs },
    );
  }

  private async handleDelivered(job: Job<SimplePayload>) {
    const { messageId } = job.data;
    await this.prisma.message.update({
      where: { id: messageId },
      data: { status: 'DELIVERED', deliveredAt: new Date() },
    });
    this.logger.log(`Message ${messageId} marked DELIVERED`);
  }

  private async handleRead(job: Job<SimplePayload>) {
    const { messageId } = job.data;
    await this.prisma.message.update({
      where: { id: messageId },
      data: { status: 'READ', readAt: new Date() },
    });
    this.logger.log(`Message ${messageId} marked READ`);
  }

  // ---- Worker event logs / failure bookkeeping ----
  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.debug(`Job ${job.name}#${job.id} active`);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.debug(`Job ${job.name}#${job.id} completed`);
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job, err: Error) {
    this.logger.error(`Job ${job.name}#${job.id} failed: ${err?.message}`);

    // If last attempt of a 'send' job failed, mark DB row FAILED
    if (job.name === 'send' && job.attemptsMade >= (job.opts.attempts ?? 1)) {
      const messageId = (job.data as SendPayload)?.messageId;
      if (messageId) {
        await this.prisma.message.update({
          where: { id: messageId },
          data: {
            status: 'FAILED',
            failedReason: err?.message ?? 'Unknown error',
          },
        });
        this.logger.warn(`Message ${messageId} marked FAILED`);
      }
    }
  }
}
