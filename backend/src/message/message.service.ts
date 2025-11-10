import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, JobsOptions } from 'bullmq';

@Injectable()
export class MessageService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('messages') private readonly messagesQueue: Queue,
  ) {}

  async create(userId: string, dto: CreateMessageDto) {
    // Ensure user exists (dev convenience)
    await this.prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId },
    });

    // Idempotency via clientMessageId
    if (dto.clientMessageId) {
      const existing = await this.prisma.message.findFirst({
        where: { userId, clientMessageId: dto.clientMessageId },
      });
      if (existing) return existing;
    }

    const message = await this.prisma.message.create({
      data: {
        userId,
        toNumber: dto.toNumber,
        body: dto.body,
        clientMessageId: dto.clientMessageId ?? null,
      },
    });

    // Deduplicate API retries on the same message
    const jobOpts: JobsOptions = { jobId: message.id };
    await this.messagesQueue.add(
      'send',
      { messageId: message.id, userId },
      jobOpts,
    );

    return message;
  }

  getById(userId: string, id: string) {
    return this.prisma.message.findFirst({ where: { id, userId } });
  }

  list(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    return this.prisma.message.findMany({
      where: { userId },
      orderBy: { queuedAt: 'desc' },
      skip,
      take: limit,
    });
  }

  /**
   * Retry a FAILED message.
   * - If the original BullMQ job still exists (since removeOnFail=false), call job.retry()
   *   to avoid jobId dedupe issues.
   * - If it does not exist (e.g. someone removed it), enqueue a fresh 'send' job.
   */
  async retry(userId: string, id: string) {
    const msg = await this.prisma.message.findFirst({ where: { id, userId } });
    if (!msg) throw new NotFoundException('Message not found');

    if (msg.status !== 'FAILED') {
      throw new BadRequestException('Only FAILED messages can be retried');
    }

    // Reset message row back to QUEUED and clear attempt timestamps/reason
    await this.prisma.message.update({
      where: { id },
      data: {
        status: 'QUEUED',
        sendingAt: null,
        sentAt: null,
        deliveredAt: null,
        readAt: null,
        failedReason: null,
      },
    });

    // Try to find the existing failed BullMQ job (jobId == message.id)
    const existingJob = await this.messagesQueue.getJob(id);

    if (existingJob) {
      // If we still have the original job, retry it. This requeues it properly.
      await existingJob.retry();
      return { ok: true, retried: true };
    } else {
      // Otherwise, enqueue a brand-new send job (same jobId is fine now as none exists)
      await this.messagesQueue.add(
        'send',
        { messageId: id, userId },
        { jobId: id },
      );
      return { ok: true, retried: false, enqueued: true };
    }
  }

  /**
   * Cancel: remove pending delayed follow-up jobs (delivered/read) for a message.
   * Note: We do not try to cancel an already running 'send' job here.
   */
  async cancel(userId: string, id: string) {
    const msg = await this.prisma.message.findFirst({ where: { id, userId } });
    if (!msg) throw new NotFoundException('Message not found');

    // Remove delayed jobs for this message (names: delivered/read)
    const delayed = await this.messagesQueue.getDelayed();
    const toRemove = delayed.filter(
      (j) =>
        (j.name === 'delivered' || j.name === 'read') &&
        j.data?.messageId === id,
    );
    for (const j of toRemove) {
      await j.remove();
    }

    return { removed: toRemove.map((j) => ({ id: j.id, name: j.name })) };
  }
}
