import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(config: ConfigService) {
    super({
      datasources: {
        db: {
          url: config.get<string>('DATABASE_URL'),
        },
      },
    });

    console.log('DB URL (Prisma):', config.get('DATABASE_URL'));
  }

  // Connect to DB
  async onModuleInit() {
    await this.$connect();
    console.log('✅ Prisma connected');
  }

  // Disconnect
  async onModuleDestroy() {
    await this.$disconnect();
    console.log('✅ Prisma disconnected');
  }
}
