const { Module } = require('@nestjs/common');
const { AppController } = require('./app.controller');
const { DatabaseModule } = require('./database/database.module');
const { TimeoffModule } = require('./timeoff/timeoff.module');
const { BalanceModule } = require('./balance/balance.module');
const { HcmModule } = require('./hcm/hcm.module');

class AppModule {}

Module({
  imports: [DatabaseModule, TimeoffModule, BalanceModule, HcmModule],
  controllers: [AppController],
})(AppModule);

module.exports = { AppModule };
