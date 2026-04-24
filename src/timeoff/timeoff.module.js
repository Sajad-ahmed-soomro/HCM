const { Module } = require('@nestjs/common');
const { TimeoffController } = require('./timeoff.controller');
const { TimeoffService } = require('./timeoff.service');
const { HcmModule } = require('../hcm/hcm.module');

class TimeoffModule {}

Module({
  imports: [HcmModule],
  controllers: [TimeoffController],
  providers: [TimeoffService],
  exports: [TimeoffService],
})(TimeoffModule);

module.exports = { TimeoffModule };
