function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withExponentialBackoff(task, options = {}) {
  const retries = typeof options.retries === 'number' ? options.retries : 3;
  const baseDelayMs = typeof options.baseDelayMs === 'number' ? options.baseDelayMs : 100;
  const maxDelayMs = typeof options.maxDelayMs === 'number' ? options.maxDelayMs : 1000;
  const shouldRetry = typeof options.shouldRetry === 'function' ? options.shouldRetry : () => false;
  const onRetry = typeof options.onRetry === 'function' ? options.onRetry : () => {};

  let attempt = 0;
  while (attempt <= retries) {
    try {
      return await task(attempt);
    } catch (error) {
      if (attempt === retries || !shouldRetry(error)) {
        throw error;
      }

      const delayMs = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
      onRetry({ attempt: attempt + 1, delayMs, error });
      await sleep(delayMs);
      attempt += 1;
    }
  }
}

module.exports = {
  withExponentialBackoff,
};
