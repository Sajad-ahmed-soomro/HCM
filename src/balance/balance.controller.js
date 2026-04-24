const { Controller, Get, Query, Inject } = require('@nestjs/common');
const { BalanceService } = require('./balance.service');

class BalanceController {
  constructor(balanceService) {
    this.balanceService = balanceService;
  }

  async getBalance(query) {
    return this.balanceService.getBalance(query.employeeId, query.locationId);
  }
}

Controller('balance')(BalanceController);
Get()(BalanceController.prototype, 'getBalance', Object.getOwnPropertyDescriptor(BalanceController.prototype, 'getBalance'));
Query()(BalanceController.prototype, 'getBalance', 0);
Inject(BalanceService)(BalanceController, undefined, 0);

module.exports = { BalanceController };
