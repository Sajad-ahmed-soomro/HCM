const { withExponentialBackoff } = require('../../src/common/retry.util');

describe('withExponentialBackoff', () => {
  it('returns successful value without retries', async () => {
    const result = await withExponentialBackoff(async () => 'ok', {
      retries: 2,
      shouldRetry: () => true,
    });

    expect(result).toBe('ok');
  });

  it('retries transient failures then succeeds', async () => {
    let attempts = 0;
    const result = await withExponentialBackoff(
      async () => {
        attempts += 1;
        if (attempts < 3) {
          const err = new Error('temporary');
          err.transient = true;
          throw err;
        }
        return 'recovered';
      },
      {
        retries: 3,
        baseDelayMs: 1,
        maxDelayMs: 2,
        shouldRetry: (err) => Boolean(err.transient),
      },
    );

    expect(result).toBe('recovered');
    expect(attempts).toBe(3);
  });
});
