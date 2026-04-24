-- Enforce non-negative leave balance at DB level for SQLite.
CREATE TRIGGER "LeaveBalance_balance_non_negative_insert"
BEFORE INSERT ON "LeaveBalance"
FOR EACH ROW
WHEN NEW.balance < 0
BEGIN
  SELECT RAISE(ABORT, 'LeaveBalance.balance must be non-negative');
END;

CREATE TRIGGER "LeaveBalance_balance_non_negative_update"
BEFORE UPDATE ON "LeaveBalance"
FOR EACH ROW
WHEN NEW.balance < 0
BEGIN
  SELECT RAISE(ABORT, 'LeaveBalance.balance must be non-negative');
END;

-- Optional data-integrity guard for request amounts.
CREATE TRIGGER "TimeOffRequest_amount_positive_insert"
BEFORE INSERT ON "TimeOffRequest"
FOR EACH ROW
WHEN NEW.amount <= 0
BEGIN
  SELECT RAISE(ABORT, 'TimeOffRequest.amount must be greater than 0');
END;

CREATE TRIGGER "TimeOffRequest_amount_positive_update"
BEFORE UPDATE ON "TimeOffRequest"
FOR EACH ROW
WHEN NEW.amount <= 0
BEGIN
  SELECT RAISE(ABORT, 'TimeOffRequest.amount must be greater than 0');
END;
