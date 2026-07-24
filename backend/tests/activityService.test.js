const activityService = require("../services/activityService");
const Activity = require("../models/Activity");

jest.mock("../models/Activity", () => ({
  create: jest.fn(),
}));

jest.mock("../utils/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
}));

describe("Activity Logging Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should successfully log a new activity", async () => {
    const mockLog = {
      userId: "123",
      userRole: "farmer",
      eventType: "crop_registered",
      batchId: "BATCH001",
      description: "New crop registered",
      metadata: { temperature: 20 },
    };

    Activity.create.mockResolvedValue(mockLog);

    const result = await activityService.logActivity(mockLog);

    expect(Activity.create).toHaveBeenCalledWith(mockLog);
    expect(result).toEqual(mockLog);
  });

  it("should catch errors and return null instead of throwing", async () => {
    Activity.create.mockRejectedValue(new Error("Database offline"));

    const result = await activityService.logActivity({
      userId: "123",
      userRole: "farmer",
      eventType: "crop_registered",
      description: "Failed attempt",
    });

    expect(result).toBeNull();
  });
});
