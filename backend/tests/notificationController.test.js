jest.mock("../models/Notification", () => ({
  find: jest.fn(),
}));

jest.mock("../utils/logger", () => ({
  error: jest.fn(),
}));

const Notification = require("../models/Notification");
const {
  getUserNotifications,
} = require("../controllers/notificationController");

const createResponse = () => ({
  statusCode: 200,
  body: null,
  status: jest.fn(function status(code) {
    this.statusCode = code;
    return this;
  }),
  json: jest.fn(function json(payload) {
    this.body = payload;
    return this;
  }),
});

const createQuery = () => ({
  sort: jest.fn().mockReturnThis(),
  limit: jest.fn().mockResolvedValue([]),
});

describe("notificationController.getUserNotifications", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test.each([
    ["the default limit when omitted", undefined, 50],
    ["a valid custom limit", "25", 25],
    ["the maximum limit", "100", 100],
  ])("uses %s", async (_description, suppliedLimit, expectedLimit) => {
    const query = createQuery();
    Notification.find.mockReturnValue(query);
    const req = {
      query: suppliedLimit === undefined ? {} : { limit: suppliedLimit },
      user: { id: "user-1" },
    };
    const res = createResponse();

    await getUserNotifications(req, res);

    expect(Notification.find).toHaveBeenCalledWith({ user: "user-1" });
    expect(query.sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(query.limit).toHaveBeenCalledWith(expectedLimit);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test.each([
    ["zero", "0"],
    ["a negative value", "-1"],
    ["a value above the maximum", "101"],
    ["an excessively large value", "1000000"],
    ["a partially numeric value", "100abc"],
    ["a decimal value", "20.5"],
    ["a non-numeric value", "abc"],
    ["an empty value", ""],
    ["a whitespace-only value", "   "],
  ])(
    "rejects %s without querying notifications",
    async (_description, limit) => {
      const req = { query: { limit }, user: { id: "user-1" } };
      const res = createResponse();

      await getUserNotifications(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.code).toBe("INVALID_NOTIFICATION_LIMIT");
      expect(res.body.message).toBe(
        "Notification limit must be an integer between 1 and 100",
      );
      expect(Notification.find).not.toHaveBeenCalled();
    },
  );
});
