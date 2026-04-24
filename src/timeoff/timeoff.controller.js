const { Controller, Post, Body, Param, Inject } = require('@nestjs/common');
const { TimeoffService } = require('./timeoff.service');

class TimeoffController {
  constructor(timeoffService) {
    this.timeoffService = timeoffService;
  }

  async create(payload) {
    return this.timeoffService.createRequest(payload);
  }

  async approve(id) {
    return this.timeoffService.approveRequest(id);
  }

  async reject(id) {
    return this.timeoffService.rejectRequest(id);
  }
}

Controller('time-off')(TimeoffController);
Post()(TimeoffController.prototype, 'create', Object.getOwnPropertyDescriptor(TimeoffController.prototype, 'create'));
Post(':id/approve')(TimeoffController.prototype, 'approve', Object.getOwnPropertyDescriptor(TimeoffController.prototype, 'approve'));
Post(':id/reject')(TimeoffController.prototype, 'reject', Object.getOwnPropertyDescriptor(TimeoffController.prototype, 'reject'));
Body()(TimeoffController.prototype, 'create', 0);
Param('id')(TimeoffController.prototype, 'approve', 0);
Param('id')(TimeoffController.prototype, 'reject', 0);
Inject(TimeoffService)(TimeoffController, undefined, 0);

module.exports = { TimeoffController };
