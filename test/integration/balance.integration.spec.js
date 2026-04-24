const { PrismaService } = require('../../src/database/prisma.service');
const { BalanceService } = require('../../src/balance/balance.service');

describe('BalanceService (integration)', () => {
  let prisma;
  let service;
  let employeeId;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    service = new BalanceService(prisma);
  });

  beforeEach(async () => {
    await prisma.timeOffRequest.deleteMany();
    await prisma.leaveBalance.deleteMany();
    await prisma.employee.deleteMany();

    const employee = await prisma.employee.create({
      data: { externalId: `ext-${Date.now()}`, name: 'Test Employee' },
    });
    employeeId = employee.id;

    await prisma.leaveBalance.create({
      data: {
        employeeId,
        locationId: 'loc-1',
        balance: 10,
      },
    });
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
  });

  it('returns balance for employee/location', async () => {
    const result = await service.getBalance(employeeId, 'loc-1');
    expect(result.balance).toBe(10);
  });
});
