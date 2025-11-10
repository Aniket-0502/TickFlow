import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QueueTestController } from './test.queue.controller';
import { MessageProcessor } from './message.processor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (cfg: ConfigService) => ({
        connection: {
          host: cfg.get<string>('REDIS_HOST', '127.0.0.1'),
          port: Number(cfg.get<string>('REDIS_PORT', '6379')),
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueueAsync({
      name: 'messages',
      imports: [ConfigModule],
      useFactory: (cfg: ConfigService) => ({
        defaultJobOptions: {
          attempts: Number(cfg.get('JOB_ATTEMPTS') ?? 3),
          backoff: {
            type: 'exponential',
            delay: Number(cfg.get('JOB_BACKOFF_MS') ?? 1000),
          },
          removeOnComplete: 50,
          removeOnFail: false,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [QueueTestController],
  providers: [MessageProcessor],
  exports: [BullModule],
})
export class QueueModule {}
