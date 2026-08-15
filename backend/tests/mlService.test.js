jest.mock("axios");

describe("mlService credential handling (fail-closed, see #1325)", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    delete process.env.ML_API_KEY;
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it("throws immediately when ML_API_KEY is not configured (no default fallback)", async () => {
    const mlService = require("../services/mlService");

    await expect(mlService.predictQuality(24, 60, "tomato")).rejects.toThrow(
      "ML_API_KEY is not configured",
    );
  });

  it("sends the configured ML_API_KEY as the X-API-Key header", async () => {
    process.env.ML_API_KEY = "super-secret-key-1234";
    const axios = require("axios");
    axios.post.mockResolvedValue({ data: { riskScore: 10.5 } });

    const mlService = require("../services/mlService");
    const result = await mlService.predictQuality(24, 60, "tomato");

    expect(result).toEqual({ riskScore: 10.5 });
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining("/quality"),
      expect.objectContaining({ temperature: 24, humidity: 60, cropType: "tomato" }),
      expect.objectContaining({
        headers: expect.objectContaining({ "X-API-Key": "super-secret-key-1234" }),
      }),
    );
  });
});
