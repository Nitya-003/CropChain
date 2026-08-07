process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test_secret";

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

// In-memory user store, mirroring the pattern used in passwordReset.test.js
const inMemoryUsers = [];

class MockUserDoc {
  constructor(data) {
    Object.assign(this, data);
  }
  async save() {
    const index = inMemoryUsers.findIndex(
      (u) => u._id.toString() === this._id.toString(),
    );
    if (index !== -1) {
      inMemoryUsers[index] = this;
    } else {
      inMemoryUsers.push(this);
    }
    return this;
  }
}

const mockUser = {
  findById: jest.fn().mockImplementation(async (id) => {
    return inMemoryUsers.find((u) => u._id.toString() === id.toString()) || null;
  }),
};

jest.mock("../models/User", () => mockUser);

const { setFallbackPassword } = require("../controllers/authController");

const buildRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe("setFallbackPassword controller", () => {
  let testUser;

  beforeEach(async () => {
    jest.clearAllMocks();
    inMemoryUsers.length = 0;

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash("OldPassword123!", salt);

    testUser = new MockUserDoc({
      _id: new mongoose.Types.ObjectId(),
      name: "Test User",
      email: "fallback@example.com",
      password: hashedPassword,
      role: "farmer",
    });
    inMemoryUsers.push(testUser);
  });

  test("sets a new password when it meets strength requirements", async () => {
    const req = {
      user: { id: testUser._id.toString() },
      body: { password: "NewPassword123!" },
    };
    const res = buildRes();

    await setFallbackPassword(req, res);

    expect(res.status).not.toHaveBeenCalledWith(400);
    expect(res.status).not.toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true }),
    );

    const updatedUser = inMemoryUsers.find(
      (u) => u._id.toString() === testUser._id.toString(),
    );
    const passwordMatch = await bcrypt.compare(
      "NewPassword123!",
      updatedUser.password,
    );
    expect(passwordMatch).toBe(true);
  });

  test("returns 400 when the password does not meet strength requirements", async () => {
    const req = {
      user: { id: testUser._id.toString() },
      body: { password: "weak" },
    };
    const res = buildRes();

    await setFallbackPassword(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false }),
    );
  });

  test("returns 404 when the user does not exist", async () => {
    const req = {
      user: { id: new mongoose.Types.ObjectId().toString() },
      body: { password: "NewPassword123!" },
    };
    const res = buildRes();

    await setFallbackPassword(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false }),
    );
  });
});