const {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  ServiceUnavailableException,
  InternalServerErrorException,
  Logger,
  Inject,
} = require('@nestjs/common');
const { PrismaService } = require('../database/prisma.service');
const { HcmService } = require('../hcm/hcm.service');
const { HcmInsufficientBalanceError, HcmUnavailableError } = require('../hcm/hcm.errors');
const { Prisma } = require('@prisma/client');
const { withExponentialBackoff } = require('../common/retry.util');

class TimeoffService {
  constructor(prisma, hcmService) {
    this.prisma = prisma;
    this.hcmService = hcmService;
    this.logger = new Logger(TimeoffService.name);
  }

  validateCreatePayload(payload) {
    if (!payload || !payload.employeeId || !payload.locationId || payload.amount === undefined) {
      throw new BadRequestException('employeeId, locationId, and amount are required');
    }

    if (typeof payload.amount !== 'number' || Number.isNaN(payload.amount) || payload.amount <= 0) {
      throw new BadRequestException('amount must be a number greater than 0');
    }
  }

  ensurePendingStatus(request) {
    if (request.status !== 'PENDING') {
      throw new ConflictException(`Only PENDING requests can transition, current status is ${request.status}`);
    }
  }

  isRetriableHcmError(error) {
    return error instanceof HcmUnavailableError;
  }

  async callHcmWithRetry(operationName, operationContext, hcmCall) {
    return withExponentialBackoff(hcmCall, {
      retries: 3,
      baseDelayMs: 100,
      maxDelayMs: 1000,
      shouldRetry: (error) => this.isRetriableHcmError(error),
      onRetry: ({ attempt, delayMs, error }) => {
        this.logger.warn(
          JSON.stringify({
            event: 'hcm_retry',
            operation: operationName,
            attempt,
            delayMs,
            error: error.message,
            context: operationContext,
          }),
        );
      },
    });
  }

  async createRequest(payload) {
    this.validateCreatePayload(payload);
    this.logger.log(
      JSON.stringify({
        event: 'create_request_received',
        employeeId: payload.employeeId,
        locationId: payload.locationId,
        amount: payload.amount,
      }),
    );

    try {
      return await this.prisma.$transaction(async (tx) => {
        const balance = await tx.leaveBalance.findUnique({
          where: {
            employeeId_locationId: {
              employeeId: payload.employeeId,
              locationId: payload.locationId,
            },
          },
        });

        if (!balance) {
          throw new NotFoundException('Leave balance not found for employee and location');
        }

        if (balance.balance < payload.amount) {
          throw new ConflictException('Insufficient local balance');
        }

        const hcmResult = await this.callHcmWithRetry(
          'verifyAndDeductBalance',
          {
            employeeId: payload.employeeId,
            locationId: payload.locationId,
          },
          () => this.hcmService.verifyAndDeductBalance(payload),
        );

        await tx.leaveBalance.update({
          where: {
            employeeId_locationId: {
              employeeId: payload.employeeId,
              locationId: payload.locationId,
            },
          },
          data: {
            balance: {
              decrement: payload.amount,
            },
          },
        });

        const request = await tx.timeOffRequest.create({
          data: {
            employeeId: payload.employeeId,
            locationId: payload.locationId,
            amount: payload.amount,
            reason: payload.reason || null,
            status: 'PENDING',
            hcmReference: hcmResult.referenceId,
            idempotencyKey: payload.idempotencyKey || null,
          },
        });

        this.logger.log(
          JSON.stringify({
            event: 'create_request_succeeded',
            requestId: request.id,
            employeeId: payload.employeeId,
            locationId: payload.locationId,
          }),
        );

        return request;
      });
    } catch (error) {
      if (error instanceof HcmInsufficientBalanceError) {
        this.logger.warn(
          JSON.stringify({
            event: 'create_request_rejected_hcm_insufficient',
            employeeId: payload.employeeId,
            locationId: payload.locationId,
            amount: payload.amount,
          }),
        );
        throw new ConflictException(error.message);
      }

      if (error instanceof HcmUnavailableError) {
        this.logger.error(
          JSON.stringify({
            event: 'create_request_hcm_unavailable',
            employeeId: payload.employeeId,
            locationId: payload.locationId,
            error: error.message,
          }),
        );
        throw new ServiceUnavailableException(error.message);
      }

      if (
        error instanceof BadRequestException ||
        error instanceof ConflictException ||
        error instanceof NotFoundException ||
        error instanceof ServiceUnavailableException
      ) {
        throw error;
      }

      const target = error && error.meta ? error.meta.target : null;
      const targetFields = Array.isArray(target) ? target : typeof target === 'string' ? [target] : [];
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        targetFields.includes('idempotencyKey')
      ) {
        this.logger.warn(
          JSON.stringify({
            event: 'create_request_duplicate_idempotency_key',
            idempotencyKey: payload.idempotencyKey || null,
          }),
        );
        throw new ConflictException('Duplicate idempotency key');
      }

      this.logger.error(
        JSON.stringify({
          event: 'create_request_failed_unexpected',
          employeeId: payload.employeeId,
          locationId: payload.locationId,
          error: error.message,
        }),
      );
      throw new InternalServerErrorException('Failed to create time-off request');
    }
  }

  async approveRequest(id) {
    const request = await this.prisma.timeOffRequest.findUnique({ where: { id } });
    if (!request) {
      throw new NotFoundException('Time-off request not found');
    }

    this.ensurePendingStatus(request);
    try {
      await this.callHcmWithRetry(
        'verifyRequestForApproval',
        {
          requestId: request.id,
          employeeId: request.employeeId,
          locationId: request.locationId,
        },
        () => this.hcmService.verifyRequestForApproval(request),
      );
    } catch (error) {
      if (error instanceof HcmUnavailableError) {
        this.logger.error(
          JSON.stringify({
            event: 'approve_request_hcm_unavailable',
            requestId: request.id,
            error: error.message,
          }),
        );
        throw new ServiceUnavailableException(error.message);
      }
      throw error;
    }

    return this.prisma.timeOffRequest.update({
      where: { id },
      data: { status: 'APPROVED' },
    });
  }

  async rejectRequest(id) {
    const request = await this.prisma.timeOffRequest.findUnique({ where: { id } });
    if (!request) {
      throw new NotFoundException('Time-off request not found');
    }

    this.ensurePendingStatus(request);

    return this.prisma.timeOffRequest.update({
      where: { id },
      data: { status: 'REJECTED' },
    });
  }
}

Injectable()(TimeoffService);
Inject(PrismaService)(TimeoffService, undefined, 0);
Inject(HcmService)(TimeoffService, undefined, 1);

module.exports = { TimeoffService };
