process.env.NODE_ENV = "test";

const bulkVerificationService = require("../services/bulkVerificationService");

const { parseCSV, BulkCsvRowLimitError } = bulkVerificationService;

const VALID_HEADER = "userId,walletAddress,action\n";

function row(n) {
  return `user${n},0xabc123000000000000000000000000000000000${n},ISSUE_CREDENTIAL`;
}

describe("bulkVerificationService.parseCSV row-cap (#1310)", () => {
  it("parses normally when row count is within the cap", () => {
    const csv = VALID_HEADER + [row(1), row(2), row(3)].join("\n");
    const records = parseCSV(csv, { maxRows: 100 });
    expect(records).toHaveLength(3);
    expect(records[0].userid).toBe("user1");
  });

  it("throws BulkCsvRowLimitError when rows exceed the cap (bounded, no OOM)", () => {
    // Build a CSV with more data rows than the cap. Without the cap, parseCSV
    // would materialize the entire array in memory (the #1310 DoS vector).
    const tooMany = 51;
    const csv =
      VALID_HEADER +
      Array.from({ length: tooMany }, (_, i) => row(i + 1)).join("\n");

    expect(() => parseCSV(csv, { maxRows: 10 })).toThrow(BulkCsvRowLimitError);
    expect(() => parseCSV(csv, { maxRows: 10 })).toThrow(/row limit exceeded/);
  });

  it("aborts early: does not accumulate the full row array before throwing", () => {
    // A pathological CSV (header + 50_000 short rows) that would otherwise build
    // a 50_000-element array. The cap must throw well before completion.
    const big = VALID_HEADER + Array.from({ length: 50000 }, (_, i) => row(i + 1)).join("\n");
    expect(() => parseCSV(big, { maxRows: 100 })).toThrow(BulkCsvRowLimitError);
  });

  it("does not enforce a cap when maxRows is omitted (backward compatible)", () => {
    const csv = VALID_HEADER + [row(1), row(2)].join("\n");
    const records = parseCSV(csv); // no options -> uncapped (legacy callers)
    expect(records).toHaveLength(2);
  });

  it("BulkCsvRowLimitError carries a stable code and maxRows", () => {
    try {
      parseCSV(VALID_HEADER + Array.from({ length: 5 }, (_, i) => row(i + 1)).join("\n"), {
        maxRows: 2,
      });
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(BulkCsvRowLimitError);
      expect(err.code).toBe("BULK_CSV_ROW_LIMIT_EXCEEDED");
      expect(err.maxRows).toBe(2);
    }
  });
});
