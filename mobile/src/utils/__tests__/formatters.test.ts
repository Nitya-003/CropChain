import {
  formatDate,
  formatTime,
  formatDateTime,
  truncateAddress,
  getStageIndex,
  capitalize,
} from "../formatters";

describe("formatDate", () => {
  it("formats a valid date string", () => {
    const result = formatDate("2024-06-15T10:30:00Z");
    expect(result).toMatch(/Jun/);
    expect(result).toMatch(/2024/);
  });

  it("handles a date with single-digit day", () => {
    const result = formatDate("2024-01-05T00:00:00Z");
    expect(result).toMatch(/Jan/);
    expect(result).toMatch(/2024/);
  });
});

describe("formatTime", () => {
  it("returns a time string for a valid date", () => {
    const result = formatTime("2024-06-15T14:30:00Z");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("handles midnight", () => {
    const result = formatTime("2024-06-15T00:00:00Z");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("formatDateTime", () => {
  it("combines date and time with 'at' separator", () => {
    const result = formatDateTime("2024-06-15T10:30:00Z");
    expect(result).toContain("at");
    expect(result).toMatch(/Jun/);
  });
});

describe("truncateAddress", () => {
  it("truncates a long address with ellipsis", () => {
    const result = truncateAddress("0x1234567890abcdef1234567890abcdef12345678");
    expect(result).toBe("0x1234...5678");
  });

  it("returns the original string for addresses shorter than 10 chars", () => {
    expect(truncateAddress("0x1234")).toBe("0x1234");
  });

  it("returns empty string for empty input", () => {
    expect(truncateAddress("")).toBe("");
  });

  it("handles null-like input gracefully", () => {
    expect(truncateAddress("abc")).toBe("abc");
  });
});

describe("getStageIndex", () => {
  it("returns 0 for farmer", () => {
    expect(getStageIndex("farmer")).toBe(0);
  });

  it("returns 2 for transport", () => {
    expect(getStageIndex("transport")).toBe(2);
  });

  it("returns -1 for unknown stage", () => {
    expect(getStageIndex("unknown")).toBe(-1);
  });
});

describe("capitalize", () => {
  it("capitalizes the first letter", () => {
    expect(capitalize("farmer")).toBe("Farmer");
  });

  it("handles single character", () => {
    expect(capitalize("a")).toBe("A");
  });

  it("returns empty string for empty input", () => {
    expect(capitalize("")).toBe("");
  });
});
