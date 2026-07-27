const crypto = require("crypto");
const apiResponse = require("./apiResponse");
const {
  getIdempotencyRecord,
  reserveIdempotencyKey,
  storeCompletedIdempotencyRecord,
  deleteIdempotencyRecord,
} = require("../services/verificationSecurityService");

const handleIdempotencyReplay = (res, record) => {
  return res.status(record.statusCode || 200).json(record.response);
};

const handleDuplicateIdempotencyKey = (res, message) => {
  return res.status(409).json(apiResponse.conflictResponse(message));
};

const createRevokeFingerprint = ({ action, actorId, userId, reason }) => {
  const payload = {
    action,
    actorId,
    userId,
    reason,
  };
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
};

const getFingerprintAndExistingRecord = async ({
  action,
  actorId,
  userId,
  reason,
  idempotencyKey,
}) => {
  const fingerprint = createRevokeFingerprint({
    action,
    actorId,
    userId,
    reason,
  });
  const existingRecord = await getIdempotencyRecord({
    action,
    actorId,
    key: idempotencyKey,
  });
  return { fingerprint, existingRecord };
};

const handleExistingIdempotencyRecord = (res, existingRecord, fingerprint) => {
  if (!existingRecord) {
    return null;
  }

  if (existingRecord.fingerprint !== fingerprint) {
    return handleDuplicateIdempotencyKey(
      res,
      "Idempotency-Key was already used for a different request",
    );
  }

  if (existingRecord.state === "completed") {
    return handleIdempotencyReplay(res, existingRecord);
  }

  return handleDuplicateIdempotencyKey(
    res,
    "Request with this Idempotency-Key is already in progress",
  );
};

const reserveOrHandleReservationOutcome = async ({
  res,
  action,
  actorId,
  idempotencyKey,
  fingerprint,
}) => {
  const reservation = await reserveIdempotencyKey({
    action,
    actorId,
    key: idempotencyKey,
    fingerprint,
  });

  if (reservation.reserved) {
    return { reservation };
  }

  if (!reservation.record) {
    return {
      response: handleDuplicateIdempotencyKey(
        res,
        "Unable to reserve the idempotency key",
      ),
    };
  }

  if (reservation.record.fingerprint !== fingerprint) {
    return {
      response: handleDuplicateIdempotencyKey(
        res,
        "Idempotency-Key was already used for a different request",
      ),
    };
  }

  if (reservation.record.state === "completed") {
    return { response: handleIdempotencyReplay(res, reservation.record) };
  }

  return {
    response: handleDuplicateIdempotencyKey(
      res,
      "Request with this Idempotency-Key is already in progress",
    ),
  };
};

/**
 * Idempotency helper for revocation endpoint.
 */
const handleIdempotencyOnly = async ({
  req,
  res,
  action,
  actorId,
  userId,
  reason,
  idempotencyKey,
  execute,
}) => {
  const { fingerprint, existingRecord } = await getFingerprintAndExistingRecord(
    {
      action,
      actorId,
      userId,
      reason,
      idempotencyKey,
    },
  );

  const existingRecordOutcome = handleExistingIdempotencyRecord(
    res,
    existingRecord,
    fingerprint,
  );
  if (existingRecordOutcome) {
    return existingRecordOutcome;
  }

  const reservationOutcome = await reserveOrHandleReservationOutcome({
    res,
    action,
    actorId,
    idempotencyKey,
    fingerprint,
  });

  if (reservationOutcome.response) {
    return reservationOutcome.response;
  }

  try {
    const result = await execute();
    await storeCompletedIdempotencyRecord({
      action,
      actorId,
      key: idempotencyKey,
      fingerprint,
      response: result,
      statusCode: 200,
    });
    return res.json(result);
  } catch (error) {
    try {
      await deleteIdempotencyRecord({ action, actorId, key: idempotencyKey });
    } catch (_) {
      // ignore
    }
    // Let controller error handler map this.
    throw error;
  }
};

const requireIdempotencyKey = (req, res) => {
  const idempotencyKey = req.get("Idempotency-Key");
  if (!idempotencyKey || !idempotencyKey.trim()) {
    res
      .status(400)
      .json(
        apiResponse.validationErrorResponse([
          "Idempotency-Key header is required",
        ]),
      );
    return null;
  }
  return idempotencyKey.trim();
};

module.exports = {
  requireIdempotencyKey,
  handleIdempotencyOnly,
};
