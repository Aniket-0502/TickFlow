import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';
import { PrismaModule } from './prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { MessageModule } from './message/message.module';
import { QueueModule } from './queue/queue.module';
import { HealthController } from './health/health.controller';
import { BullModule } from '@nestjs/bullmq';
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRoot({
      connection: {
        // ideally from env via ConfigService
        host: '127.0.0.1',
        port: 6379,
      },
    }),
    PrismaModule,
    MessageModule,
    QueueModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
