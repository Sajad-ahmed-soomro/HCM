const { Injectable, Logger } = require('@nestjs/common');
const { HcmInsufficientBalanceError, HcmUnavailableError } = require('./hcm.errors');

class HcmService {
  constructor() {
    this.logger = new Logger(HcmService.name);
    this.failureRate = 0.2;
    this.balances = new Map();
  }

  getBalanceKey(employeeId, locationId) {
    return `${employeeId}:${locationId}`;
  }

  maybeFailRandomly(overrideFailureRate) {
    const failureRate =
      typeof overrideFailureRate === 'number' && overrideFailureRate >= 0 && overrideFailureRate <= 1
        ? overrideFailureRate
        : this.failureRate;

    if (Math.random() < failureRate) {
      throw new HcmUnavailableError('HCM transient failure');
    }
  }

  readBalance(employeeId, locationId) {
    const key = this.getBalanceKey(employeeId, locationId);
    if (!this.balances.has(key)) {
      return 0;
    }
    return this.balances.get(key);
  }

  writeBalance(employeeId, locationId, balance) {
    const key = this.getBalanceKey(employeeId, locationId);
    this.balances.set(key, balance);
  }

  async verifyAndDeductBalance(payload) {
    this.logger.log(`HCM verify/deduct requested for employee ${payload.employeeId}`);

    if (payload.simulateHcmDown) {
      throw new HcmUnavailableError();
    }

    if (payload.simulateInsufficient) {
      throw new HcmInsufficientBalanceError();
    }

    this.maybeFailRandomly(payload.failureRate);

    const currentBalance = this.readBalance(payload.employeeId, payload.locationId);
    if (currentBalance < payload.amount) {
      throw new HcmInsufficientBalanceError();
    }

    this.writeBalance(payload.employeeId, payload.locationId, currentBalance - payload.amount);

    return {
      success: true,
      referenceId: `hcm-deduct-${payload.employeeId}-${Date.now()}`,
      remainingBalance: currentBalance - payload.amount,
    };
  }

  async getBalance(employeeId, locationId) {
    this.logger.log(`HCM balance requested for ${employeeId} @ ${locationId}`);
    this.maybeFailRandomly();
    return { employeeId, locationId, balance: this.readBalance(employeeId, locationId) };
  }

  async verifyRequestForApproval(request) {
    this.logger.log(`HCM approval check for request ${request.id}`);
    this.maybeFailRandomly();
    return {
      approvedByHcm: true,
      referenceId: `hcm-approve-${request.id}-${Date.now()}`,
    };
  }

  async batchOverwrite(payload) {
    const entries = Array.isArray(payload && payload.entries) ? payload.entries : [];
    this.maybeFailRandomly(payload && payload.failureRate);

    let updated = 0;
    for (const entry of entries) {
      if (!entry || !entry.employeeId || !entry.locationId || typeof entry.balance !== 'number') {
        continue;
      }
      if (entry.balance < 0) {
        continue;
      }
      this.writeBalance(entry.employeeId, entry.locationId, entry.balance);
      updated += 1;
    }

    return {
      success: true,
      updated,
      totalReceived: entries.length,
      overwrittenAt: new Date().toISOString(),
    };
  }
}

Injectable()(HcmService);

module.exports = { HcmService };
