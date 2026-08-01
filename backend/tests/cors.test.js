const express = require("express");
const cors = require("cors");
const request = require("supertest");
const { createCorsOptions } = require("../startup/middleware");

const ALLOWED_ORIGINS = ["http://trusted.com", "http://frontend.com"];

function buildTestApp() {
  const app = express();
  app.use(cors(createCorsOptions(ALLOWED_ORIGINS)));
  app.get("/api/status", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });
  return app;
}

describe("CORS Configuration", () => {
  let app;

  beforeEach(() => {
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
    app = buildTestApp();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("should allow requests from ALLOWED_ORIGINS with credentials", async () => {
    const res = await request(app)
      .get("/api/status")
      .set("Origin", "http://trusted.com");

    expect(res.status).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBe("http://trusted.com");
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });

  test("should allow requests from FRONTEND_URL", async () => {
    const res = await request(app)
      .get("/api/status")
      .set("Origin", "http://frontend.com");

    expect(res.status).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBe("http://frontend.com");
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });

  test("should block requests from disallowed origins", async () => {
    const res = await request(app)
      .get("/api/status")
      .set("Origin", "http://evil.com");

    expect(res.status).not.toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    expect(res.headers["access-control-allow-credentials"]).toBeUndefined();
  });

  test("should deny requests with no origin when credentials are enabled", async () => {
    const res = await request(app).get("/api/status");

    // The request still executes (CORS is browser-enforced), but no origin or
    // credential headers are reflected, so no-Origin clients cannot gain
    // credentialed access.
    expect(res.status).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    expect(res.headers["access-control-allow-credentials"]).toBeUndefined();
  });
});
