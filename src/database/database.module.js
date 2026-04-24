const { Global, Module } = require('@nestjs/common');
const { PrismaService } = require('./prisma.service');

class DatabaseModule {}

Global()(DatabaseModule);
Module({
  providers: [PrismaService],
  exports: [PrismaService],
})(DatabaseModule);

module.exports = { DatabaseModule };
