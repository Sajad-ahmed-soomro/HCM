const { Injectable, NotFoundException, BadRequestException, Inject } = require('@nestjs/common');
const { PrismaService } = require('../database/prisma.service');

class BalanceService {
  constructor(prisma) {
    this.prisma = prisma;
  }

  async getBalance(employeeId, locationId) {
    if (!employeeId || !locationId) {
      throw new BadRequestException('employeeId and locationId are required');
    }

    const balance = await this.prisma.leaveBalance.findUnique({
      where: {
        employeeId_locationId: {
          employeeId,
          locationId,
        },
      },
    });

    if (!balance) {
      throw new NotFoundException('Balance not found for employee and location');
    }

    return balance;
  }
}

Injectable()(BalanceService);
Inject(PrismaService)(BalanceService, undefined, 0);

module.exports = { BalanceService };
