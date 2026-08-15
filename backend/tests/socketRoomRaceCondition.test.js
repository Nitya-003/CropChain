const jwt = require("jsonwebtoken");
const http = require("http");
const { io: Client } = require("socket.io-client");
const { initializeSocketIO, closeSocketIO } = require("../services/socketService");

describe("WebSocket Room Join Race Condition & Pending Queue Test Suite", () => {
  let server;
  let serverPort;
  let clientSocket;
  const JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-key-123456";

  beforeAll((done) => {
    process.env.JWT_SECRET = JWT_SECRET;
    server = http.createServer();
    initializeSocketIO(server);
    server.listen(0, () => {
      serverPort = server.address().port;
      done();
    });
  });

  afterAll((done) => {
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
    }
    server.close(done);
  });

  it("should queue room join request sent before authentication completes", (done) => {
    clientSocket = Client(`http://localhost:${serverPort}`, {
      transports: ["websocket"],
      reconnection: false,
    });

    clientSocket.on("connect", () => {
      // Emit room join before sending auth token
      clientSocket.emit("join-batch-room", "CROP-2024-RACE-01");
    });

    clientSocket.on("room-join-queued", (res) => {
      expect(res.status).toBe("queued");
      expect(res.batchId).toBe("CROP-2024-RACE-01");

      // Now emit runtime authentication
      const token = jwt.sign(
        { id: "user_test_99", role: "farmer", farmerId: "user_test_99" },
        JWT_SECRET,
        { expiresIn: "1h" }
      );
      clientSocket.emit("authenticate", { token });
    });

    clientSocket.on("joined-batch-room", (res) => {
      expect(res.batchId).toBe("CROP-2024-RACE-01");
      expect(res.status).toBe("auto-fulfilled");
      done();
    });
  });
});
