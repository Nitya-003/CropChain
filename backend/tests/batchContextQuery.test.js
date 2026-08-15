const aiService = require("../services/aiService");

describe("Context-Aware Batch Querying Tests", () => {
  describe("Metadata Sanitization", () => {
    it("should correctly sanitize batch metadata, keeping supply chain details and omitting sensitive data", () => {
      const rawBatch = {
        _id: "mongo-id-123",
        batchId: "CROP-2024-0001",
        farmerId: "farmer-uuid-456",
        farmerName: "John Doe",
        farmerAddress: "123 Farm Road, Sector 4",
        farmerWalletAddress: "0x1234567890abcdef",
        cropType: "rice",
        quantity: 500,
        harvestDate: new Date("2024-01-15"),
        origin: "Punjab, India",
        currentStage: "mandi",
        isRecalled: false,
        syncStatus: "synced",
        status: "Active",
        iotData: {
          currentTemperature: 22,
          currentHumidity: 55,
          isSpoiled: false,
          telemetryHistory: [],
        },
        updates: [
          {
            stage: "farmer",
            actor: "John Doe",
            location: "Punjab",
            timestamp: new Date("2024-01-15"),
            notes: "Harvested",
          },
        ],
        lifecycle: {
          currentStage: "Registered",
          stageHistory: [
            {
              stage: "Registered",
              timestamp: new Date("2024-01-15"),
              updatedBy: "John Doe",
              notes: "Initial registration",
            },
          ],
        },
        __v: 0,
      };

      const sanitized = aiService.sanitizeBatchMetadata(rawBatch);

      // Assertions on kept fields
      expect(sanitized.batchId).toBe("CROP-2024-0001");
      expect(sanitized.cropType).toBe("rice");
      expect(sanitized.quantity).toBe(500);
      expect(sanitized.origin).toBe("Punjab, India");
      expect(sanitized.currentStage).toBe("mandi");
      expect(sanitized.isRecalled).toBe(false);
      expect(sanitized.status).toBe("Active");
      expect(sanitized.iotData.currentTemperature).toBe(22);
      expect(sanitized.iotData.isSpoiled).toBe(false);
      expect(sanitized.updates[0].stage).toBe("farmer");

      // Assertions on omitted fields
      expect(sanitized._id).toBeUndefined();
      expect(sanitized.farmerId).toBeUndefined();
      expect(sanitized.farmerAddress).toBeUndefined();
      expect(sanitized.farmerWalletAddress).toBeUndefined();
      expect(sanitized.__v).toBeUndefined();
    });
  });

  describe("Transit Statistics Calculation", () => {
    it("should correctly calculate the average transit times in days", () => {
      const date1 = new Date("2024-01-15T00:00:00.000Z");
      const date2 = new Date("2024-01-16T12:00:00.000Z"); // 1.5 days later
      const date3 = new Date("2024-01-18T12:00:00.000Z"); // 2.0 days later

      const batches = [
        {
          updates: [
            { stage: "farmer", timestamp: date1 },
            { stage: "mandi", timestamp: date2 },
            { stage: "transport", timestamp: date3 },
          ],
        },
      ];

      const stats = aiService.calculateTransitStats(batches, "wheat");

      expect(stats.cropType).toBe("wheat");
      expect(stats.sampleSize).toBe(1);
      expect(stats.averageFarmerToMandi).toBe("1.50 days");
      expect(stats.averageMandiToTransport).toBe("2.00 days");
      expect(stats.averageTransportToRetailer).toBe("N/A");
    });
  });

  describe("AI Service Context Flow", () => {
    it("should trigger status updates while performing context querying", async () => {
      const mockBatchService = {
        getBatchByIdOrPartial: jest.fn().mockResolvedValue({
          batchId: "CROP-2024-0001",
          cropType: "rice",
          farmerName: "John Doe",
          origin: "Punjab",
          quantity: 500,
          harvestDate: new Date(),
          currentStage: "farmer",
          blockchainHash: "0x123",
          updates: [],
          lifecycle: { stageHistory: [] },
          iotData: { isSpoiled: false },
        }),
        searchBatches: jest.fn().mockResolvedValue([]),
        getDashboardStats: jest.fn().mockResolvedValue({ stats: {} }),
      };

      const statusUpdates = [];
      const onStatus = (status) => statusUpdates.push(status);

      // We use provider = 'fallback' so we don't hit the external APIs
      const originalProvider = aiService.provider;
      aiService.provider = "fallback";

      await aiService.chatWithBatchContext(
        "Where is batch #0001?",
        {},
        mockBatchService,
        null,
        onStatus,
      );

      expect(mockBatchService.getBatchByIdOrPartial).toHaveBeenCalledWith(
        "0001",
      );
      expect(statusUpdates).toContain(
        "Searching database for batch details...",
      );
      expect(statusUpdates).toContain("Generating response...");

      aiService.provider = originalProvider;
    });
  });

  describe("Page Context Awareness", () => {
    it("should build a different system prompt for the same question on different pages", async () => {
      const mockBatchService = {
        getDashboardStats: jest
          .fn()
          .mockResolvedValue({ stats: { totalBatches: 10 } }),
      };

      // response mock is generic enough to satisfy both calls; we only care what
      // prompt each call was built with
      const makeModel = () => ({
        startChat: jest.fn().mockReturnValue({
          sendMessage: jest.fn().mockResolvedValue({
            response: { text: () => "ok", functionCalls: () => [] },
          }),
        }),
      });

      const originalProvider = aiService.provider;
      const originalGenAI = aiService.genAI;
      aiService.provider = "gemini";
      const getGenerativeModel = jest.fn().mockImplementation(makeModel);
      aiService.genAI = { getGenerativeModel };

      await aiService.chatWithBatchContext(
        "what should I do here?",
        { currentPage: "add-batch", userRole: "farmer" },
        mockBatchService,
        null,
        null,
      );
      await aiService.chatWithBatchContext(
        "what should I do here?",
        { currentPage: "track-batch", userRole: "farmer" },
        mockBatchService,
        null,
        null,
      );

      const addBatchPrompt = getGenerativeModel.mock.calls[0][0].systemInstruction;
      const trackBatchPrompt = getGenerativeModel.mock.calls[1][0].systemInstruction;

      expect(addBatchPrompt).toContain("Current page: add-batch");
      expect(trackBatchPrompt).toContain("Current page: track-batch");
      expect(addBatchPrompt).not.toBe(trackBatchPrompt);

      aiService.provider = originalProvider;
      aiService.genAI = originalGenAI;
    });
  });

  describe("Gemini Function-Calling for Multi-Filter Queries", () => {
    it("should call search_batches with all requested filters and return only the matching batches", async () => {
      const matchingBatches = [
        {
          batchId: "CROP-2024-0007",
          cropType: "rice",
          farmerName: "Ravi Singh",
          origin: "Punjab, India",
          currentStage: "mandi",
          quantity: 400,
          createdAt: new Date("2024-02-01"),
        },
      ];

      const mockBatchService = {
        searchBatches: jest.fn().mockResolvedValue(matchingBatches),
      };

      const toolCall = {
        name: "search_batches",
        args: { cropType: "rice", origin: "Punjab", status: "Flagged" },
      };

      // sendFunctionResponse() reads response.candidates[0].content to replay the
      // model's turn back to it, so the mock needs that shape too, not just functionCalls()
      const sendMessage = jest.fn().mockResolvedValueOnce({
        response: {
          functionCalls: () => [toolCall],
          candidates: [
            { content: { role: "model", parts: [{ functionCall: toolCall }] } },
          ],
        },
      });

      // follow-up goes through model.generateContent(), not chat.sendMessage() again
      // (see sendFunctionResponse in aiService.js)
      const generateContent = jest.fn().mockResolvedValueOnce({
        response: {
          text: () => "Found 1 flagged rice batch from Punjab: CROP-2024-0007.",
        },
      });

      const originalProvider = aiService.provider;
      const originalGenAI = aiService.genAI;
      aiService.provider = "gemini";
      aiService.genAI = {
        getGenerativeModel: jest.fn().mockReturnValue({
          startChat: jest.fn().mockReturnValue({ sendMessage }),
          generateContent,
        }),
      };

      const result = await aiService.chatWithBatchContext(
        "find rice batches from Punjab that are flagged",
        {},
        mockBatchService,
        null,
        null,
      );

      expect(mockBatchService.searchBatches).toHaveBeenCalledWith({
        cropType: "rice",
        origin: "Punjab",
        status: "Flagged",
      });
      expect(result.message).toBe(
        "Found 1 flagged rice batch from Punjab: CROP-2024-0007.",
      );
      expect(result.functionCalled).toBe("search_batches");
      expect(result.functionResult.data).toEqual([
        expect.objectContaining({ batchId: "CROP-2024-0007" }),
      ]);

      aiService.provider = originalProvider;
      aiService.genAI = originalGenAI;
    });
  });
});
