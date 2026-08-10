/**
 * Regression tests for #1291: a transient Redis connection failure (socket
 * disconnect / failover / ECONNREFUSED) must not crash the BullMQ worker
 * process via an unhandled 'error' event. The connection created by
 * createQueueConnection() must absorb 'error' emissions and keep the process
 * alive.
 */
const {
  createQueueConnection,
  attachConnectionHandlers,
} = require("../config/redis");

describe("Redis connection resilience (#1291)", () => {
  let connections = [];

  afterEach(async () => {
    await Promise.all(
      connections.map((c) => {
        try {
          c.disconnect(false);
        } catch {
          /* ignore */
        }
        return c.quit?.().catch(() => {});
      }),
    );
    connections = [];
  });

  it("createQueueConnection attaches an 'error' listener so an error event does not throw", (done) => {
    // Temporarily remove the process-level listeners so this test proves the
    // *connection-level* listener is what prevents the crash.
    const conn = createQueueConnection();
    connections.push(conn);

    expect(conn.listenerCount("error")).toBeGreaterThanOrEqual(1);
    expect(conn.listenerCount("close")).toBeGreaterThanOrEqual(1);
    expect(conn.listenerCount("reconnecting")).toBeGreaterThanOrEqual(1);

    // Emitting 'error' with a listener present must NOT throw and must NOT
    // kill the process.
    expect(() => {
      conn.emit("error", new Error("Connection is closed."));
    }).not.toThrow();

    expect(() => {
      conn.emit("close");
      conn.emit("reconnecting", 200);
    }).not.toThrow();

    done();
  });

  it("attachConnectionHandlers is idempotent (no duplicate listeners)", () => {
    const conn = createQueueConnection();
    connections.push(conn);
    const before = conn.listenerCount("error");
    attachConnectionHandlers(conn); // second time — should be a no-op
    attachConnectionHandlers(conn); // third time
    expect(conn.listenerCount("error")).toBe(before);
  });

  it("does not attach handlers to a null/undefined connection", () => {
    expect(attachConnectionHandlers(null)).toBeNull();
    expect(attachConnectionHandlers(undefined)).toBeUndefined();
  });

  it("exposes attachConnectionHandlers for hardening duplicate() connections (pub/sub)", () => {
    const conn = createQueueConnection();
    connections.push(conn);
    const dup = conn.duplicate();
    connections.push(dup);
    // duplicate() does NOT carry over listeners — harden it explicitly.
    expect(dup.listenerCount("error")).toBe(0);
    attachConnectionHandlers(dup);
    expect(dup.listenerCount("error")).toBeGreaterThanOrEqual(1);
    expect(() => dup.emit("error", new Error("ECONNREFUSED"))).not.toThrow();
  });
});
