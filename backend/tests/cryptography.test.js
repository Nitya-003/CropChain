const { calculateUpdateHash } = require("../utils/cryptography");

describe("Cryptographic Hashing Layer", () => {
  const update1 = {
    stage: "farmer",
    actor: "Farmer John",
    location: "Green Valley Farm",
    timestamp: "2026-07-10T12:00:00.000Z",
    notes: "Tomato harvest",
  };

  const update2 = {
    stage: "mandi",
    actor: "Mandi Inspector",
    location: "Central Market",
    timestamp: "2026-07-11T09:00:00.000Z",
    notes: "Quality checked",
  };

  it("should generate a valid SHA-256 hex string", () => {
    const hash = calculateUpdateHash(update1, "");
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("should be deterministic and output same hash for same inputs", () => {
    const hashA = calculateUpdateHash(update1, "");
    const hashB = calculateUpdateHash(update1, "");
    expect(hashA).toBe(hashB);
  });

  it("should generate different hashes for different update contents", () => {
    const hash1 = calculateUpdateHash(update1, "");
    const hash2 = calculateUpdateHash(update2, "");
    expect(hash1).not.toBe(hash2);
  });

  it("should produce different hash if previous hash changes (chaining validation)", () => {
    const prevHashA =
      "0000000000000000000000000000000000000000000000000000000000000000";
    const prevHashB =
      "1111111111111111111111111111111111111111111111111111111111111111";

    const hashA = calculateUpdateHash(update2, prevHashA);
    const hashB = calculateUpdateHash(update2, prevHashB);

    expect(hashA).not.toBe(hashB);
  });

  it("should handle undefined notes and normalize stage names", () => {
    const updateNoNotes = {
      stage: "Farmer", // Mixed case
      actor: "Farmer John",
      location: "Green Valley Farm",
      timestamp: "2026-07-10T12:00:00.000Z",
    };

    const hash = calculateUpdateHash(updateNoNotes, "");
    expect(hash).toBeDefined();

    const normalizedUpdate = {
      stage: "farmer", // Lowercase
      actor: "Farmer John",
      location: "Green Valley Farm",
      timestamp: "2026-07-10T12:00:00.000Z",
      notes: "",
    };
    const expectedNormalizedHash = calculateUpdateHash(normalizedUpdate, "");
    expect(hash).toBe(expectedNormalizedHash);
  });
});
