const { ConflictException, ServiceUnavailableException } = require('@nestjs/common');
const { TimeoffService } = require('../../src/timeoff/timeoff.service');
const { HcmUnavailableError } = require('../../src/hcm/hcm.errors');

function createMockPrisma() {
  return {
    $transaction: async (fn) => fn({
      leaveBalance: {
        findUnique: jest.fn().mockResolvedValue({ employeeId: 'e1', locationId: 'l1', balance: 8 }),
        update: jest.fn().mockResolvedValue({}),
      },
      timeOffRequest: {
        create: jest.fn().mockResolvedValue({ id: 'r1', status: 'PENDING' }),
      },
    }),
    timeOffRequest: {
      findUnique: jest.fn().mockResolvedValue({ id: 'r1', status: 'PENDING', employeeId: 'e1', locationId: 'l1' }),
      update: jest.fn().mockResolvedValue({ id: 'r1', status: 'APPROVED' }),
    },
  };
}

describe('TimeoffService (unit)', () => {
  it('maps HCM unavailable to 503', async () => {
    const prisma = createMockPrisma();
    const hcmService = {
      verifyAndDeductBalance: jest.fn().mockRejectedValue(new HcmUnavailableError('down')),
      verifyRequestForApproval: jest.fn().mockResolvedValue({ approvedByHcm: true }),
    };

    const service = new TimeoffService(prisma, hcmService);

    await expect(
      service.createRequest({ employeeId: 'e1', locationId: 'l1', amount: 2 }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('prevents invalid status transition on approve', async () => {
    const prisma = createMockPrisma();
    prisma.timeOffRequest.findUnique = jest.fn().mockResolvedValue({ id: 'r1', status: 'REJECTED' });
    const hcmService = {
      verifyAndDeductBalance: jest.fn(),
      verifyRequestForApproval: jest.fn(),
    };

    const service = new TimeoffService(prisma, hcmService);
    await expect(service.approveRequest('r1')).rejects.toBeInstanceOf(ConflictException);
  });
});
