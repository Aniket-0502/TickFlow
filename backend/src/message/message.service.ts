import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class MessageService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('messages') private readonly messagesQueue: Queue,
  ) {}

  async create(userId: string, dto: CreateMessageDto) {
    // 1) Make sure the user exists (fixes P2003)
    await this.prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId },
    });

    // 2) Idempotency
    if (dto.clientMessageId) {
      const existing = await this.prisma.message.findFirst({
        where: { userId, clientMessageId: dto.clientMessageId },
      });
      if (existing) return existing;
    }

    // 3) Create message
    const message = await this.prisma.message.create({
      data: {
        userId,
        toNumber: dto.toNumber,
        body: dto.body,
        clientMessageId: dto.clientMessageId ?? null,
      },
    });

    // 4) Enqueue with required payload (fixes undefined messageId in processor)
    await this.messagesQueue.add(
      'send',
      { messageId: message.id },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 500 },
        removeOnComplete: true,
        removeOnFail: false,
      },
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
}
