const { Module } = require('@nestjs/common');
const { BalanceController } = require('./balance.controller');
const { BalanceService } = require('./balance.service');

class BalanceModule {}

Module({
  controllers: [BalanceController],
  providers: [BalanceService],
  exports: [BalanceService],
})(BalanceModule);

module.exports = { BalanceModule };
