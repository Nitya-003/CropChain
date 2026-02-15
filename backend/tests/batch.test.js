const request = require("supertest");
const app = require("../server");
const mongoose = require("mongoose");

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

  it("should create a valid batch", async () => {
    const res = await request(app).post("/api/batches").send({
      farmerId: "FARM123",
      farmerName: "Test Farmer",
      farmerAddress: "123 Green Lane",
      cropType: "rice",
      quantity: 50,
      harvestDate: "2024-01-01",
      origin: "Test Origin",
      description: "Good rice"
    });

    expect(res.statusCode).toEqual(201);
    expect(res.body.success).toBe(true);
    expect(res.body.batch).toHaveProperty("batchId");
  });

  it("should prevent invalid stage transition", async () => {
    // 1. Create batch
    const createRes = await request(app).post("/api/batches").send({
      farmerId: "FARM123",
      farmerName: "Test Farmer",
      farmerAddress: "123 Green Lane",
      cropType: "rice",
      quantity: 50,
      harvestDate: "2024-01-01",
      origin: "Test Origin",
      description: "Good rice"
    });
    const batchId = createRes.body.batch.batchId;

    // 2. Try to jump to retailer (skipping mandi and transport)
    const updateRes = await request(app).put(`/api/batches/${batchId}`).send({
        stage: "retailer",
        actor: "Retailer Guy",
        location: "Shop",
        timestamp: "2024-01-02",
        notes: "Received"
    });

    expect(updateRes.statusCode).toEqual(400);
    expect(updateRes.body.error).toEqual("Invalid stage transition");
  });
  
  afterAll(async () => {
    // Close mongoose connection if open (it might not be due to our mock in db.js)
    if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
    }
  });
});
