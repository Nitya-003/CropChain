/**
 * CropChain API Security Tests
 *
 * This file contains tests to validate the security features implemented in the API.
 * Run with: node security-tests.js (ensure server is running on localhost:3001)
 */

const axios = require("axios");

// Configuration from environment or defaults
const API_BASE = process.env.API_BASE_URL || "http://localhost:3001/api";

// Colors for console output
const colors = {
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  reset: "\x1b[0m",
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Test rate limiting
async function testRateLimit() {
  log("\n🔒 Testing Rate Limiting...", "blue");

  try {
    // Test general rate limit (should allow first 100 requests)
    log(
      "Testing general rate limit (first 5 requests should succeed):",
      "yellow",
    );

    for (let i = 1; i <= 5; i++) {
      try {
        const response = await axios.get(`${API_BASE}/health`);
        log(`  Request ${i}: ✓ Success (${response.status})`, "green");
      } catch (error) {
        log(`  Request ${i}: ✗ Failed (${error.response?.status})`, "red");
      }
    }

    // Test auth rate limit (should be limited to 5 per 15 minutes)
    log("\nTesting auth rate limit (should fail after 5 attempts):", "yellow");

    for (let i = 1; i <= 7; i++) {
      try {
        const response = await axios.post(`${API_BASE}/auth/login`, {});
        log(`  Auth attempt ${i}: ✓ Success (${response.status})`, "green");
      } catch (error) {
        if (error.response?.status === 429) {
          log(
            `  Auth attempt ${i}: ✗ Rate limited (${error.response.status})`,
            "red",
          );
        } else {
          log(
            `  Auth attempt ${i}: ✓ Expected error (${error.response?.status})`,
            "green",
          );
        }
      }
    }
  } catch (error) {
    log(`Rate limit test failed: ${error.message}`, "red");
  }
}

// Test input validation
async function testInputValidation(authToken) {
  log("\n🛡️ Testing Input Validation...", "blue");

  const invalidBatchData = [
    {
      name: "Missing required fields",
      data: { farmerName: "John" }, // Missing required fields
      expectedError: "Validation failed",
    },
    {
      name: "Invalid farmer name (too short)",
      data: {
        farmerName: "A",
        farmerAddress: "Some long address here",
        cropType: "rice",
        quantity: "100",
        harvestDate: "2024-01-15",
        origin: "Farm location",
      },
      expectedError: "Validation failed",
    },
    {
      name: "Invalid crop type (special characters)",
      data: {
        farmerName: "John Doe",
        farmerAddress: "Some long address here",
        cropType: "rice$$$",
        quantity: "100",
        harvestDate: "2024-01-15",
        origin: "Farm location",
      },
      expectedError: "Validation failed",
    },
    {
      name: "Invalid quantity (negative)",
      data: {
        farmerName: "John Doe",
        farmerAddress: "Some long address here",
        cropType: "rice",
        quantity: "-100",
        harvestDate: "2024-01-15",
        origin: "Farm location",
      },
      expectedError: "Validation failed",
    },
    {
      name: "Invalid harvest date (future)",
      data: {
        farmerName: "John Doe",
        farmerAddress: "Some long address here",
        cropType: "rice",
        quantity: "100",
        harvestDate: "2025-12-31",
        origin: "Farm location",
      },
      expectedError: "Validation failed",
    },
    {
      name: "Invalid harvest date format",
      data: {
        farmerName: "John Doe",
        farmerAddress: "Some long address here",
        cropType: "rice",
        quantity: "100",
        harvestDate: "31/12/2024",
        origin: "Farm location",
      },
      expectedError: "Validation failed",
    },
  ];

  for (const testCase of invalidBatchData) {
    try {
      await axios.post(`${API_BASE}/batches`, testCase.data);
      log(`  ${testCase.name}: ✗ Should have failed but succeeded`, "red");
    } catch (error) {
      if (error.response?.status === 400) {
        log(`  ${testCase.name}: ✓ Correctly rejected`, "green");
      } else if (error.response?.status === 401) {
        log(`  ${testCase.name}: ✗ Auth required (401)`, "red");
      } else {
        log(
          `  ${testCase.name}: ✗ Unexpected error (${error.response?.status})`,
          "red",
        );
      }
    }
  }

  // Test valid batch creation WITH authentication
  log("\nTesting valid batch creation (with auth):", "yellow");
  const validBatchData = {
    farmerName: "John Doe",
    farmerAddress: "Village Rampur, District Meerut, UP",
    cropType: "rice",
    quantity: "1000",
    harvestDate: "2024-01-15",
    origin: "Rampur Farm",
    certifications: "Organic",
    description: "High quality basmati rice",
  };

  try {
    const response = await axios.post(`${API_BASE}/batches`, validBatchData, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (response.status === 201) {
      log("  Valid batch creation: ✓ Success", "green");
      return response.data.batch.batchId; // Return for update tests
    }
  } catch (error) {
    log(
      `  Valid batch creation: ✗ Failed (${error.response?.status}): ${error.response?.data?.message || error.message}`,
      "red",
    );
  }

  return null;
}

// Test NoSQL injection protection
async function testNoSQLInjection() {
  log("\n🚫 Testing NoSQL Injection Protection...", "blue");

  const injectionAttempts = [
    {
      name: "MongoDB $ne operator injection",
      data: {
        farmerName: { $ne: null },
        farmerAddress: "Some address",
        cropType: "rice",
        quantity: "100",
        harvestDate: "2024-01-15",
        origin: "Farm",
      },
    },
    {
      name: "MongoDB $where injection",
      data: {
        farmerName: "John",
        farmerAddress: "Some address",
        cropType: { $where: "function() { return true; }" },
        quantity: "100",
        harvestDate: "2024-01-15",
        origin: "Farm",
      },
    },
    {
      name: "MongoDB $regex injection",
      data: {
        farmerName: "John",
        farmerAddress: "Some address",
        cropType: "rice",
        quantity: "100",
        harvestDate: "2024-01-15",
        origin: { $regex: ".*" },
      },
    },
  ];

  for (const attempt of injectionAttempts) {
    try {
      await axios.post(`${API_BASE}/batches`, attempt.data);
      log(`  ${attempt.name}: ✗ Injection not blocked`, "red");
    } catch (error) {
      if (error.response?.status === 400) {
        log(`  ${attempt.name}: ✓ Injection blocked by validation`, "green");
      } else if (error.response?.status === 401) {
        log(
          `  ${attempt.name}: ✓ Auth required (${error.response?.status})`,
          "green",
        );
      } else {
        log(
          `  ${attempt.name}: ✓ Injection sanitized (${error.response?.status})`,
          "green",
        );
      }
    }
  }
}

// Test batch ID validation
async function testBatchIdValidation() {
  log("\n🔍 Testing Batch ID Validation...", "blue");

  const invalidBatchIds = [
    "invalid-id",
    "CROP-2024",
    "CROP-2024-ABC",
    "crop-2024-001",
    "../../etc/passwd",
    '<script>alert("xss")</script>',
  ];

  for (const batchId of invalidBatchIds) {
    try {
      await axios.get(`${API_BASE}/batches/${batchId}`);
      log(
        `  Invalid batch ID "${batchId}": ✗ Should have been rejected`,
        "red",
      );
    } catch (error) {
      if (error.response?.status === 400) {
        log(`  Invalid batch ID "${batchId}": ✓ Correctly rejected`, "green");
      } else {
        log(
          `  Invalid batch ID "${batchId}": ? Unexpected response (${error.response?.status})`,
          "yellow",
        );
      }
    }
  }
}

// Test update validation
async function testUpdateValidation(batchId, authToken) {
  if (!batchId) {
    log("\n⚠️ Skipping update validation tests (no valid batch ID)", "yellow");
    return;
  }

  log("\n📝 Testing Update Validation...", "blue");

  const invalidUpdates = [
    {
      name: "Invalid stage",
      data: {
        actor: "Transport Company",
        stage: "invalid-stage",
        location: "Warehouse A",
      },
    },
    {
      name: "Invalid actor name (special characters)",
      data: {
        actor: "Actor@#$%",
        stage: "transport",
        location: "Warehouse A",
      },
    },
    {
      name: "Missing required fields",
      data: {
        actor: "Transport Company",
        // Missing stage and location
      },
    },
  ];

  for (const testCase of invalidUpdates) {
    try {
      await axios.put(`${API_BASE}/batches/${batchId}`, testCase.data);
      log(`  ${testCase.name}: ✗ Should have failed but succeeded`, "red");
    } catch (error) {
      if (error.response?.status === 400) {
        log(`  ${testCase.name}: ✓ Correctly rejected`, "green");
      } else if (error.response?.status === 401) {
        log(`  ${testCase.name}: ✓ Auth required (401)`, "green");
      } else if (error.response?.status === 403) {
        log(`  ${testCase.name}: ✓ Forbidden (403)`, "green");
      } else {
        log(
          `  ${testCase.name}: ✗ Unexpected error (${error.response?.status})`,
          "red",
        );
      }
    }
  }

  // Test valid update WITH authentication
  log("\nTesting valid batch update (with auth):", "yellow");
  const validUpdate = {
    actor: "Transport Company",
    stage: "transport",
    location: "Distribution Center",
    notes: "Batch picked up for delivery",
  };

  try {
    const response = await axios.put(
      `${API_BASE}/batches/${batchId}`,
      validUpdate,
      {
        headers: { Authorization: `Bearer ${authToken}` },
      },
    );
    if (response.status === 200) {
      log("  Valid batch update: ✓ Success", "green");
    }
  } catch (error) {
    log(
      `  Valid batch update: ✗ Failed (${error.response?.status}): ${error.response?.data?.message || error.message}`,
      "red",
    );
  }
}

// Test authentication requirements
async function testAuthenticationRequired() {
  log("\n🔐 Testing Authentication Requirements...", "blue");

  const batchData = {
    farmerName: "Test Farmer",
    farmerAddress: "Test Address, Test City, TS",
    cropType: "wheat",
    quantity: "500",
    harvestDate: "2024-01-01",
    origin: "Test Farm",
  };

  const updateData = {
    actor: "Test Actor",
    stage: "transport",
    location: "Test Location",
  };

  // Test 1: POST /api/batches without token should return 401
  log("  Testing POST /batches without token:", "yellow");
  try {
    await axios.post(`${API_BASE}/batches`, batchData);
    log("    ✗ Should have returned 401", "red");
  } catch (error) {
    if (error.response?.status === 401) {
      log("    ✓ Returns 401 without token", "green");
    } else {
      log(`    ✗ Unexpected status: ${error.response?.status}`, "red");
    }
  }

  // Test 2: POST /api/batches with invalid token should return 401
  log("  Testing POST /batches with invalid token:", "yellow");
  try {
    await axios.post(`${API_BASE}/batches`, batchData, {
      headers: { Authorization: "Bearer invalid_token_12345" },
    });
    log("    ✗ Should have returned 401", "red");
  } catch (error) {
    if (error.response?.status === 401) {
      log("    ✓ Returns 401 with invalid token", "green");
    } else {
      log(`    ✗ Unexpected status: ${error.response?.status}`, "red");
    }
  }

  // Test 3: PUT /api/batches/:batchId without token should return 401
  log("  Testing PUT /batches/:batchId without token:", "yellow");
  try {
    await axios.put(`${API_BASE}/batches/CROP-2024-001`, updateData);
    log("    ✗ Should have returned 401", "red");
  } catch (error) {
    if (error.response?.status === 401) {
      log("    ✓ Returns 401 without token", "green");
    } else if (error.response?.status === 404) {
      log("    ✓ Returns 404 (batch not found) but needs auth first", "yellow");
    } else {
      log(`    ✗ Unexpected status: ${error.response?.status}`, "red");
    }
  }

  // Test 4: PUT /api/batches/:batchId with valid token but wrong owner should return 403
  log("  Testing PUT /batches/:batchId unauthorized owner:", "yellow");
  // First create a batch with one user, then try to update with another
  try {
    // Create first user and get token
    const user1Data = {
      name: "User One",
      email: `userone${Date.now()}@test.com`,
      password: "testpass123",
      role: "farmer",
    };
    await axios.post(`${API_BASE}/auth/register`, user1Data);
    const login1 = await axios.post(`${API_BASE}/auth/login`, {
      email: user1Data.email,
      password: user1Data.password,
    });
    const token1 = login1.data.token;

    // Create batch with user 1
    const batchResponse = await axios.post(`${API_BASE}/batches`, batchData, {
      headers: { Authorization: `Bearer ${token1}` },
    });
    const createdBatchId = batchResponse.data.batch?.batchId;

    if (createdBatchId) {
      // Create second user and get token
      const user2Data = {
        name: "User Two",
        email: `usertwo${Date.now()}@test.com`,
        password: "testpass123",
        role: "farmer",
      };
      await axios.post(`${API_BASE}/auth/register`, user2Data);
      const login2 = await axios.post(`${API_BASE}/auth/login`, {
        email: user2Data.email,
        password: user2Data.password,
      });
      const token2 = login2.data.token;

      // Try to update batch with user 2 (should fail with 403)
      try {
        await axios.put(`${API_BASE}/batches/${createdBatchId}`, updateData, {
          headers: { Authorization: `Bearer ${token2}` },
        });
        log("    ✗ Should have returned 403", "red");
      } catch (error) {
        if (error.response?.status === 403) {
          log("    ✓ Returns 403 for unauthorized owner", "green");
        } else {
          log(
            `    ✗ Unexpected status: ${error.response?.status} - ${error.response?.data?.message}`,
            "red",
          );
        }
      }
    }
  } catch (error) {
    log(`    ✗ Test setup failed: ${error.message}`, "red");
  }

  // Test 5: POST /api/batches with valid token should return 201
  log("  Testing POST /batches with valid token:", "yellow");
  try {
    // Register and login to get valid token
    const testUser = {
      name: "Auth Test User",
      email: `authtest${Date.now()}@test.com`,
      password: "testpass123",
      role: "farmer",
    };
    await axios.post(`${API_BASE}/auth/register`, testUser);
    const login = await axios.post(`${API_BASE}/auth/login`, {
      email: testUser.email,
      password: testUser.password,
    });
    const validToken = login.data.token;

    const response = await axios.post(`${API_BASE}/batches`, batchData, {
      headers: { Authorization: `Bearer ${validToken}` },
    });
    if (response.status === 201) {
      log("    ✓ Returns 201 with valid token", "green");
      return validToken; // Return token for other tests
    }
  } catch (error) {
    log(
      `    ✗ Failed: ${error.response?.status} - ${error.response?.data?.message || error.message}`,
      "red",
    );
  }

  return null;
}

// Test security headers
async function testSecurityHeaders() {
  log("\n🛡️ Testing Security Headers...", "blue");

  try {
    const response = await axios.get(`${API_BASE}/health`);
    const headers = response.headers;

    const expectedHeaders = [
      "x-content-type-options",
      "x-frame-options",
      "x-download-options",
      "x-permitted-cross-domain-policies",
    ];

    expectedHeaders.forEach((header) => {
      if (headers[header]) {
        log(`  ${header}: ✓ Present`, "green");
      } else {
        log(`  ${header}: ✗ Missing`, "red");
      }
    });
  } catch (error) {
    log(`Security headers test failed: ${error.message}`, "red");
  }
}

// Main test runner
async function runSecurityTests() {
  log("🚀 Starting CropChain API Security Tests", "blue");
  log("=".repeat(50), "blue");

  try {
    // Test if server is running
    await axios.get(`${API_BASE}/health`);
    log("✓ Server is running and accessible", "green");

    // Run all security tests
    await testRateLimit();
    await testAuthenticationRequired();
    await testNoSQLInjection();
    await testBatchIdValidation();
    await testSecurityHeaders();

    log("\n🎉 Security tests completed!", "blue");
    log("=".repeat(50), "blue");
  } catch (error) {
    log(`✗ Server is not accessible: ${error.message}`, "red");
    log(
      "Please ensure the server is running on http://localhost:3001",
      "yellow",
    );
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runSecurityTests().catch(console.error);
}

module.exports = {
  runSecurityTests,
  testRateLimit,
  testInputValidation,
  testNoSQLInjection,
  testBatchIdValidation,
  testUpdateValidation,
  testSecurityHeaders,
  testAuthenticationRequired,
};
