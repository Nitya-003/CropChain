const http = require("http");
const express = require("express");
const socketService = require("../services/socketService");
const { createPubSubClients } = require("../config/redis");

describe("Socket.IO Redis Adapter & Horizontal Scaling", () => {
  let server;

  beforeAll((done) => {
    const app = express();
    server = http.createServer(app);
    server.listen(0, () => {
      done();
    });
  });

  afterAll((done) => {
    if (server) {
      server.close(done);
    } else {
      done();
    }
  });

  it("should initialize Socket.IO server instance", () => {
    const io = socketService.initializeSocketIO(server);
    expect(io).toBeDefined();
    expect(socketService.getIO()).toBe(io);
  });

  it("should create pub/sub Redis connection clients for multi-node scaling", () => {
    const clients = createPubSubClients();
    expect(clients).toHaveProperty("pubClient");
    expect(clients).toHaveProperty("subClient");
    expect(clients.pubClient).toBeDefined();
    expect(clients.subClient).toBeDefined();

    // Clean up test clients
    clients.pubClient.disconnect();
    clients.subClient.disconnect();
  });
});
