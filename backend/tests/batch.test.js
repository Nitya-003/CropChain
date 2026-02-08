const request = require("supertest");
const app = require("../server");

describe("Batch API Endpoints", () => {
  //  tests will go inside here! 
  it("should return 400 if quantity is negative", async () => {
    const res = await request(app).post("/api/batches").send({
      farmerId: "FARM123",
      farmerName: "Test Farmer",
      farmerAddress: "123 Green Lane",
      cropType: "rice",
      quantity: -50, // This is the invalid data 
      harvestDate: "2024-01-01",
      origin: "Test Origin",
    });

    // check if the server did what we expected
    expect(res.statusCode).toEqual(400);
    expect(res.body).toHaveProperty("error");
  });
});
