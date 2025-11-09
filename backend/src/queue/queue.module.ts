// src/queue/queue.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';

import { PrismaModule } from '../prisma/prisma.module';
import { QueueTestController } from './test.queue.controller';
import { MessageProcessor } from './message.processor';

@Module({
  imports: [
    // use existing global ConfigModule but importing here is harmless and keeps this module standalone
    ConfigModule.forRoot({ isGlobal: true }),

    // BullMQ connection via env, fallback to localhost
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', '127.0.0.1'),
          port: parseInt(config.get<string>('REDIS_PORT', '6379'), 10),
          // password: config.get<string>('REDIS_PASSWORD'), // uncomment if needed
          // tls: ...                                  // if using managed TLS Redis
        },
      }),
    }),

    // Register our queue
    BullModule.registerQueue({
      name: 'messages',
    }),

    // Needed so MessageProcessor can inject PrismaService
    PrismaModule,
  ],
  controllers: [QueueTestController], // temporary test route
  providers: [MessageProcessor],
  exports: [BullModule],
})
export class QueueModule {}
