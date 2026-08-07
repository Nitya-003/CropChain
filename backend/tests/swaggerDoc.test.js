const swaggerSpec = require("../swagger");

describe("Swagger / OpenAPI Specification Generator Test Suite", () => {
  it("should generate a valid OpenAPI 3.0.0 object", () => {
    expect(swaggerSpec).toBeDefined();
    expect(swaggerSpec.openapi).toBe("3.0.0");
    expect(swaggerSpec.info).toBeDefined();
    expect(swaggerSpec.info.title).toContain("CropChain");
  });

  it("should contain essential schemas in components", () => {
    const schemas = swaggerSpec.components?.schemas;
    expect(schemas).toBeDefined();
    expect(schemas.Batch).toBeDefined();
    expect(schemas.User).toBeDefined();
    expect(schemas.LoginCredentials).toBeDefined();
    expect(schemas.ImageDiagnosisResponse).toBeDefined();
    expect(schemas.TelemetryData).toBeDefined();
    expect(schemas.ApiResponse).toBeDefined();
  });

  it("should include defined API tags", () => {
    const tags = swaggerSpec.tags.map((t) => t.name);
    expect(tags).toContain("Batches");
    expect(tags).toContain("Authentication");
    expect(tags).toContain("AI ML Service");
    expect(tags).toContain("IoT Telemetry");
    expect(tags).toContain("Verification");
  });

  it("should parse annotated route paths correctly", () => {
    const paths = Object.keys(swaggerSpec.paths || {});
    expect(paths.length).toBeGreaterThan(0);
    expect(paths).toContain("/api/batches");
    expect(paths).toContain("/api/auth/register");
    expect(paths).toContain("/api/auth/login");
    expect(paths).toContain("/api/ai/chat");
  });
});
