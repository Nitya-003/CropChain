const mockInstances = [];

jest.mock("pdfkit", () => {
  const EventEmitter = require("events");

  class MockPDFDocument extends EventEmitter {
    constructor() {
      super();
      this.page = { width: 595, height: 842 };
      this.y = 50;
      this.operations = [];
    }

    record(method, args) {
      this.operations.push({ method, args });
      return this;
    }

    fillColor(...args) {
      return this.record("fillColor", args);
    }
    fontSize(...args) {
      return this.record("fontSize", args);
    }
    font(...args) {
      return this.record("font", args);
    }
    moveDown(...args) {
      this.y += 8;
      return this.record("moveDown", args);
    }
    rect(...args) {
      return this.record("rect", args);
    }
    roundedRect(...args) {
      return this.record("roundedRect", args);
    }
    fill(...args) {
      return this.record("fill", args);
    }
    stroke(...args) {
      return this.record("stroke", args);
    }
    fillAndStroke(...args) {
      return this.record("fillAndStroke", args);
    }
    circle(...args) {
      return this.record("circle", args);
    }
    image(...args) {
      return this.record("image", args);
    }
    addPage(...args) {
      this.y = 50;
      return this.record("addPage", args);
    }
    switchToPage(...args) {
      return this.record("switchToPage", args);
    }
    bufferedPageRange() {
      return { count: 1 };
    }

    text(...args) {
      this.y += 12;
      return this.record("text", args);
    }

    end() {
      this.emit("data", Buffer.from("PDF_DUMMY_DATA"));
      this.emit("end");
    }
  }

  return jest.fn().mockImplementation(() => {
    const doc = new MockPDFDocument();
    mockInstances.push(doc);
    return doc;
  });
});

const pdfService = require("../services/pdfService");

describe("PDFService.generateBatchJourneyPDF", () => {
  beforeEach(() => {
    mockInstances.length = 0;
  });

  const baseBatch = {
    batchId: "BATCH000001",
    cropType: "rice",
    quantity: 1000,
    harvestDate: "2024-01-15",
    origin: "Punjab",
    farmerName: "John Farmer",
    currentStage: "farmer",
    status: "active",
    updates: [],
  };

  test("draws prominent recall warnings at the top and in Compliance when recalled", async () => {
    await pdfService.generateBatchJourneyPDF({
      ...baseBatch,
      isRecalled: true,
    });

    const textValues = mockInstances[0].operations
      .filter((operation) => operation.method === "text")
      .map((operation) => operation.args[0]);
    const alertStyles = mockInstances[0].operations
      .filter((operation) => operation.method === "fillAndStroke")
      .map((operation) => operation.args);

    expect(textValues).toContain("RECALLED");
    expect(textValues).toContain("RECALLED BATCH WARNING");
    expect(textValues).toContain(
      "CRITICAL FOOD SAFETY ALERT: This batch has been recalled and should not be distributed, sold, or consumed.",
    );
    expect(textValues).toContain(
      "This compliance report documents a recalled batch. Treat all chain-of-custody records as unsafe or withdrawn.",
    );
    expect(alertStyles).toEqual([
      ["#fef2f2", "#dc2626"],
      ["#fef2f2", "#dc2626"],
    ]);
  });

  test("does not draw recall warning banners for active batches", async () => {
    await pdfService.generateBatchJourneyPDF({
      ...baseBatch,
      isRecalled: false,
    });

    const textValues = mockInstances[0].operations
      .filter((operation) => operation.method === "text")
      .map((operation) => operation.args[0]);

    expect(textValues).not.toContain("RECALLED");
    expect(textValues).not.toContain("RECALLED BATCH WARNING");
  });
});
