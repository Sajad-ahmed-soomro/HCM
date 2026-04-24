const { Injectable, OnModuleInit, OnModuleDestroy } = require('@nestjs/common');
const { PrismaClient } = require('@prisma/client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');

class PrismaService extends PrismaClient {
  constructor() {
    const databaseUrl = process.env.DATABASE_URL || 'file:./dev.db';
    const dbPath = databaseUrl.replace('file:', '');
    const adapter = new PrismaBetterSqlite3({
      url: dbPath,
    });

    super({
      adapter,
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

Injectable()(PrismaService);

module.exports = { PrismaService };
