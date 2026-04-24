const request = require('supertest');
const { Test } = require('@nestjs/testing');
const { AppModule } = require('../../src/app.module');
const { PrismaService } = require('../../src/database/prisma.service');
const { HcmService } = require('../../src/hcm/hcm.service');
const { HcmUnavailableError } = require('../../src/hcm/hcm.errors');

describe('Time-Off API (e2e)', () => {
  let app;
  let prisma;
  let hcmService;
  let employeeId;

  async function seedEmployeeWithBalance(balance) {
    const employee = await prisma.employee.create({
      data: { externalId: `ext-${Date.now()}-${Math.random()}`, name: 'E2E Employee' },
    });
    employeeId = employee.id;
    await prisma.leaveBalance.create({
      data: { employeeId, locationId: 'loc-1', balance },
    });
    await hcmService.batchOverwrite({
      entries: [{ employeeId, locationId: 'loc-1', balance }],
      failureRate: 0,
    });
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    prisma = app.get(PrismaService);
    hcmService = app.get(HcmService);
    hcmService.failureRate = 0;
  });

  beforeEach(async () => {
    await prisma.timeOffRequest.deleteMany();
    await prisma.leaveBalance.deleteMany();
    await prisma.employee.deleteMany();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('creates request successfully', async () => {
    await seedEmployeeWithBalance(8);

    const res = await request(app.getHttpServer())
      .post('/api/time-off')
      .send({ employeeId, locationId: 'loc-1', amount: 2, reason: 'Vacation' })
      .expect(201);

    expect(res.body.status).toBe('PENDING');
    expect(res.body.amount).toBe(2);
  });

  it('rejects insufficient balance request', async () => {
    await seedEmployeeWithBalance(1);

    await request(app.getHttpServer())
      .post('/api/time-off')
      .send({ employeeId, locationId: 'loc-1', amount: 3 })
      .expect(409);
  });

  it('returns service unavailable after HCM retries exhausted', async () => {
    await seedEmployeeWithBalance(5);
    hcmService.failureRate = 0;

    const downSpy = jest
      .spyOn(hcmService, 'verifyAndDeductBalance')
      .mockRejectedValue(new HcmUnavailableError('down'));

    await request(app.getHttpServer())
      .post('/api/time-off')
      .send({ employeeId, locationId: 'loc-1', amount: 1 })
      .expect(503);

    downSpy.mockRestore();
  });

  it('applies batch overwrite in mock HCM', async () => {
    await seedEmployeeWithBalance(5);

    await request(app.getHttpServer())
      .post('/api/hcm/batch')
      .send({
        failureRate: 0,
        entries: [{ employeeId, locationId: 'loc-1', balance: 12 }],
      })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get('/api/hcm/balance')
      .query({ employeeId, locationId: 'loc-1' })
      .expect(200);

    expect(res.body.balance).toBe(12);
  });

  it('handles concurrent requests without double-approval effect', async () => {
    await seedEmployeeWithBalance(3);

    const server = app.getHttpServer();
    const payload = { employeeId, locationId: 'loc-1', amount: 2 };

    const [a, b] = await Promise.allSettled([
      request(server).post('/api/time-off').send(payload),
      request(server).post('/api/time-off').send(payload),
    ]);

    const results = [a, b].map((item) => (item.status === 'fulfilled' ? item.value.statusCode : 500));
    const successCount = results.filter((code) => code === 201).length;

    expect(successCount).toBe(1);
  });
});
