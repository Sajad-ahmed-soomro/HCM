class HcmInsufficientBalanceError extends Error {
  constructor(message = 'HCM reports insufficient balance') {
    super(message);
    this.name = 'HcmInsufficientBalanceError';
  }
}

class HcmUnavailableError extends Error {
  constructor(message = 'HCM is unavailable') {
    super(message);
    this.name = 'HcmUnavailableError';
  }
}

module.exports = {
  HcmInsufficientBalanceError,
  HcmUnavailableError,
};
