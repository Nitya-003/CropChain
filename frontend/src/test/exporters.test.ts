import { describe, it, expect } from "vitest";
import {
  generateBatchCSVString,
  generateBatchPDFHTML,
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
