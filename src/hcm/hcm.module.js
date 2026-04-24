const { Module } = require('@nestjs/common');
const { HcmController } = require('./hcm.controller');
const { HcmService } = require('./hcm.service');

class HcmModule {}

Module({
  controllers: [HcmController],
  providers: [HcmService],
  exports: [HcmService],
})(HcmModule);

module.exports = { HcmModule };
