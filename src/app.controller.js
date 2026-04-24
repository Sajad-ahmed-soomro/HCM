const { Controller, Get } = require('@nestjs/common');

class AppController {
  health() {
    return {
      service: 'time-off-microservice',
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}

Controller('health')(AppController);
Get()(AppController.prototype, 'health', Object.getOwnPropertyDescriptor(AppController.prototype, 'health'));

module.exports = { AppController };
