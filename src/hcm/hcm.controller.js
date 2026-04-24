const { Controller, Get, Post, Query, Body, Inject } = require('@nestjs/common');
const { HcmService } = require('./hcm.service');

class HcmController {
  constructor(hcmService) {
    this.hcmService = hcmService;
  }

  async balance(query) {
    return this.hcmService.getBalance(query.employeeId, query.locationId);
  }

  async deduct(body) {
    return this.hcmService.verifyAndDeductBalance(body);
  }

  async batch(body) {
    return this.hcmService.batchOverwrite(body);
  }
}

Controller('hcm')(HcmController);
Get('balance')(HcmController.prototype, 'balance', Object.getOwnPropertyDescriptor(HcmController.prototype, 'balance'));
Post('deduct')(HcmController.prototype, 'deduct', Object.getOwnPropertyDescriptor(HcmController.prototype, 'deduct'));
Post('batch')(HcmController.prototype, 'batch', Object.getOwnPropertyDescriptor(HcmController.prototype, 'batch'));
Query()(HcmController.prototype, 'balance', 0);
Body()(HcmController.prototype, 'deduct', 0);
Body()(HcmController.prototype, 'batch', 0);
Inject(HcmService)(HcmController, undefined, 0);

module.exports = { HcmController };
