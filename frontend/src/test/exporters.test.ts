import { describe, it, expect } from "vitest";
import {
  generateBatchCSVString,
  generateBatchPDFHTML,
  sanitizeCsvCell,
  ExportableBatch,
} from "../utils/exporters";

describe("PDF & CSV Exporters Utility Test Suite", () => {
  const sampleBatch: ExportableBatch = {
    id: "BATCH-2026-X100",
    batchId: "BATCH-2026-X100",
    cropType: "Rice",
    farmerName: "Suresh Patel",
    farmerAddress: "Punjab Farm Hub",
    origin: "Ludhiana Mandi",
    quantity: 1200,
    unit: "kg",
    harvestDate: "2026-07-28",
    status: "active",
    currentStage: "transporter",
    certifications: "ISO-22000 Certified Organic",
    description: "Basmati rice batch 1200kg",
    updates: [
      {
        timestamp: "2026-07-28T10:00:00Z",
        stage: "farmer",
        location: "Ludhiana Farm",
        actor: "Suresh Patel",
        temperature: 24,
        humidity: 60,
      },
      {
        timestamp: "2026-07-29T14:30:00Z",
        stage: "mandi",
        location: "Central Mandi Ludhiana",
        actor: "Mandi Inspector",
        temperature: 26,
        humidity: 58,
      },
    ],
  };

  describe("generateBatchCSVString", () => {
    it("should format batch metadata headers and values into CSV", () => {
      const csv = generateBatchCSVString(sampleBatch);
      expect(csv).toContain('"BATCH-2026-X100"');
      expect(csv).toContain('"Rice"');
      expect(csv).toContain('"Suresh Patel"');
      expect(csv).toContain('"ISO-22000 Certified Organic"');
    });

    it("should include timeline stage updates in CSV format", () => {
      const csv = generateBatchCSVString(sampleBatch);
      expect(csv).toContain("--- SUPPLY CHAIN TIMELINE STAGES ---");
      expect(csv).toContain('"farmer"');
      expect(csv).toContain('"Ludhiana Farm"');
      expect(csv).toContain('"mandi"');
    });
  });

  describe("sanitizeCsvCell - CSV/Formula injection protection", () => {
    it("prefixes values starting with = (HYPERLINK attack)", () => {
      const payload = '=HYPERLINK("http://bad.test","Click")';
      const cell = sanitizeCsvCell(payload);
      // Leading = must be defanged with a leading single quote, never left bare.
      expect(cell).toBe(`"'=HYPERLINK(""http://bad.test"",""Click"")"`);
      expect(cell.startsWith(`"=`)).toBe(false);
    });

    it("prefixes values starting with + - @ and tab/CR", () => {
      // Each value gets a leading single-quote prefix to neutralize the trigger char.
      expect(sanitizeCsvCell("+1+1")).toBe(`"'+1+1"`);
      expect(sanitizeCsvCell("-DDE")).toBe(`"'-DDE"`);
      expect(sanitizeCsvCell("@SUM(A1:A2)")).toBe(`"'@SUM(A1:A2)"`);
      expect(sanitizeCsvCell("\tignored")).toBe(`"'\tignored"`);
      expect(sanitizeCsvCell("\rignored")).toBe(`"'\rignored"`);
    });

    it("leaves normal values untouched (only RFC 4180 quoting)", () => {
      expect(sanitizeCsvCell("Rice")).toBe('"Rice"');
      expect(sanitizeCsvCell("1200")).toBe('"1200"');
    });

    it("doubles embedded double-quotes per RFC 4180", () => {
      expect(sanitizeCsvCell('He said "hi"')).toBe('"He said ""hi"""');
    });

    it("handles leading whitespace before a formula prefix", () => {
      // Spreadsheet apps trim leading whitespace before evaluating a formula.
      const cell = sanitizeCsvCell("   =cmd|...");
      expect(cell).toBe(`"'   =cmd|..."`);
      expect(cell.startsWith(`"=`)).toBe(false);
    });

    it("does NOT defang a value that merely contains = mid-string", () => {
      // Only a leading formula-trigger char is dangerous.
      expect(sanitizeCsvCell("a=b")).toBe('"a=b"');
    });
  });

  describe("generateBatchCSVString - formula injection end-to-end", () => {
    it("defangs a malicious brand/crop name in the exported CSV", () => {
      const malicious: ExportableBatch = {
        batchId: "BATCH-EVIL",
        cropType: '=HYPERLINK("http://bad.test","Click")',
        farmerName: "+SUM(A1:A2)",
        origin: "@cmd|calc!A0",
        quantity: 10,
        harvestDate: "2026-01-01",
        description: "Normal text",
        updates: [
          {
            timestamp: "2026-01-01T00:00:00Z",
            stage: "-DDE",
            location: "loc",
            notes: '=cmd|"/c calc"!A0',
          },
        ],
      };
      const csv = generateBatchCSVString(malicious);

      // The defanged single-quote prefix must be present for each malicious value.
      expect(csv).toContain(`"'=HYPERLINK`);
      expect(csv).toContain(`"'+SUM`);
      expect(csv).toContain(`"'@cmd`);
      expect(csv).toContain(`"'=cmd`);

      // No data cell may begin (after the opening quote) with a bare formula trigger.
      const dataRows = csv
        .split("\n")
        .filter((l) => l.startsWith('"') && !l.startsWith('"---'));
      dataRows.forEach((row) => {
        const cells = row.match(/"(?:[^"]|"")*"/g) || [];
        cells.forEach((c) => {
          const inner = c.slice(1, -1).replace(/""/g, '"');
          const trimmed = inner.trimStart();
          if (trimmed.length) {
            expect(["=", "+", "-", "@", "\t", "\r"]).not.toContain(trimmed[0]);
          }
        });
      });
    });
  });

  describe("generateBatchPDFHTML", () => {
    it("should generate HTML report containing CropChain provenance header and batch details", async () => {
      const html = await generateBatchPDFHTML(sampleBatch);
      expect(html).toContain("CropChain Provenance Certificate");
      expect(html).toContain("BATCH-2026-X100");
      expect(html).toContain("Suresh Patel");
      expect(html).toContain("Ludhiana Farm");
    });
  });
});
