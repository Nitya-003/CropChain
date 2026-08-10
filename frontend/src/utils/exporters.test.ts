import { describe, it, expect } from "vitest";
import { generateBatchCSVString, sanitizeCsvCell } from "./exporters";
import type { ExportableBatch } from "./exporters";

describe("sanitizeCsvCell (CWE-1236 formula injection)", () => {
  it("prefixes values that start with formula trigger characters", () => {
    expect(sanitizeCsvCell("=HYPERLINK(\"http://bad.test\",\"Click\")")).toBe(
      "'=HYPERLINK(\"http://bad.test\",\"Click\")",
    );
    expect(sanitizeCsvCell("+1+1")).toBe("'+1+1");
    expect(sanitizeCsvCell("-2+3")).toBe("'-2+3");
    expect(sanitizeCsvCell("@SUM(A1:A2)")).toBe("'@SUM(A1:A2)");
  });

  it("prefixes tab- and carriage-return-prefixed values", () => {
    expect(sanitizeCsvCell("\tcmd")).toBe("'\tcmd");
    expect(sanitizeCsvCell("\rcmd")).toBe("'\rcmd");
  });

  it("leaves benign values untouched", () => {
    expect(sanitizeCsvCell("Wheat")).toBe("Wheat");
    expect(sanitizeCsvCell("Batch #123")).toBe("Batch #123");
    expect(sanitizeCsvCell("1,000 kg")).toBe("1,000 kg");
  });

  it("coerces non-strings and handles nullish", () => {
    expect(sanitizeCsvCell(42)).toBe("42");
    expect(sanitizeCsvCell(0)).toBe("0");
    expect(sanitizeCsvCell(null)).toBe("");
    expect(sanitizeCsvCell(undefined)).toBe("");
  });

  it("does not false-positive on a value that merely contains a trigger char mid-string", () => {
    expect(sanitizeCsvCell("a=b")).toBe("a=b");
    expect(sanitizeCsvCell("hello @user")).toBe("hello @user");
  });
});

describe("generateBatchCSVString", () => {
  const baseBatch: ExportableBatch = {
    batchId: "BATCH-1",
    cropType: "Wheat",
    farmerName: "Jane Farmer",
    farmerAddress: "1 Farm Lane",
    origin: "Pune",
    quantity: 100,
    harvestDate: "2026-01-01",
    status: "Harvested",
    currentStage: "Storage",
    certifications: "Organic",
    description: "Premium wheat",
    updates: [
      {
        timestamp: "2026-01-02T10:00:00Z",
        stage: "Transport",
        location: "Mumbai",
        actor: "Driver X",
        txHash: "0xabc",
        notes: "Refrigerated",
      },
    ],
  };

  it("escapes embedded quotes and preserves a normal batch round-trip", () => {
    const csv = generateBatchCSVString({
      ...baseBatch,
      farmerName: 'Jane "Farmer"',
    });
    expect(csv).toContain('"Jane ""Farmer"""');
    expect(csv).toContain('"BATCH-1","Wheat"');
  });

  it("neutralizes a formula payload in every user-controlled cell", () => {
    const csv = generateBatchCSVString({
      ...baseBatch,
      cropType: '=HYPERLINK("http://bad.test","Click")',
      farmerName: "+Inject",
      description: "@SUM(A1)",
      updates: [
        {
          timestamp: "2026-01-02T10:00:00Z",
          stage: "=cmd|'/c calc'!A1",
          location: "-2+3",
          actor: "\tbad",
          notes: "@evil",
        },
      ],
    });

    // No cell may start (after the opening quote) with a trigger character.
    // i.e. the char immediately following each opening `"` must not be = + - @ \t \r
    // unless it is the single-quote sanitizer prefix.
    const cellPattern = /"(=|\+|-|@|\t|\r)/g;
    expect(csv).not.toMatch(cellPattern);

    // Sanitizer prefix is present for the affected values.
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain("'+Inject");
    expect(csv).toContain("'@SUM(A1)");
    expect(csv).toContain("'=cmd|'/c calc'!A1");
    expect(csv).toContain("'-2+3");
    expect(csv).toContain("'\tbad");
    expect(csv).toContain("'@evil");
  });

  it("does not mangle numeric quantity/temperature/humidity fields", () => {
    const csv = generateBatchCSVString({
      ...baseBatch,
      quantity: 0,
      updates: [{ temperature: 0, humidity: 0 }],
    });
    expect(csv).toContain('"0"');
  });
});
