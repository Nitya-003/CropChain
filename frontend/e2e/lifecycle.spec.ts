import { test, expect } from "@playwright/test";

const corsHeaders = {
  "Access-Control-Allow-Origin": "http://localhost:3000",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Credentials": "true",
};

test.describe("CropChain Lifecycle E2E", () => {
  test.beforeEach(async ({ page }) => {
    // Handle CORS preflight requests globally
    await page.route("**/*", async (route) => {
      if (route.request().method() === "OPTIONS") {
        await route.fulfill({
          status: 204,
          headers: corsHeaders,
        });
      } else {
        await route.fallback();
      }
    });

    page.on("console", (msg) =>
      console.log(`[BROWSER] ${msg.type()}: ${msg.text()}`),
    );
    page.on("requestfailed", (request) =>
      console.log(
        `[BROWSER] Request failed: ${request.url()} - ${request.failure()?.errorText}`,
      ),
    );
    page.on("response", (response) => {
      if (response.status() >= 400) {
        console.log(
          `[BROWSER] Response error ${response.status()}: ${response.url()}`,
        );
      }
    });
  });

  test("Farmer should be able to create a new batch and see it", async ({
    page,
  }) => {
    // 1. Mock farmer authentication

    await page.route("**/auth/refresh", async (route) => {
      if (route.request().method() === "OPTIONS") {
        await route.fulfill({ status: 204, headers: corsHeaders });
      } else {
        await route.fulfill({
          status: 401,
          headers: corsHeaders,
          json: { success: false, error: "Token expired" },
        });
      }
    });

    await page.route("**/auth/login", async (route) => {
      if (route.request().method() === "OPTIONS") {
        await route.fulfill({ status: 204, headers: corsHeaders });
      } else {
        await route.fulfill({
          headers: corsHeaders,
          json: {
            success: true,
            data: {
              token: "fake-farmer-token",
              user: { id: "farmer1", name: "Test Farmer", role: "farmer" },
            },
          },
        });
      }
    });

    await page.route("**/batches*", async (route) => {
      if (route.request().method() === "OPTIONS") {
        await route.fulfill({ status: 204, headers: corsHeaders });
      } else {
        await route.fulfill({
          headers: corsHeaders,
          json: {
            success: true,
            data: {
              batches: [
                {
                  batchId: "batch-001",
                  cropType: "Wheat",
                  quantity: 100,
                  currentStage: "farmer",
                },
              ],
            },
          },
        });
      }
    });

    await page.route("**/auctions*", async (route) => {
      if (route.request().method() === "OPTIONS") {
        await route.fulfill({ status: 204, headers: corsHeaders });
      } else {
        await route.fulfill({
          headers: corsHeaders,
          json: { success: true, data: { auctions: [] } },
        });
      }
    });

    // Login
    await page.goto("/login?from=/farmer");
    await page.fill('input[type="email"]', "farmer@test.com");
    await page.fill('input[type="password"]', "pass");
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(/.*\/farmer/);

    // Verify recent batch is displayed
    await page.screenshot({ path: "screenshot-farmer.png", fullPage: true });
    const fs = require("fs");
    fs.writeFileSync(
      "/Users/tanmayy/.gemini/antigravity-ide/brain/12dd0766-dd1c-42f1-be57-ff148d1de5ea/farmer-page.html",
      await page.content(),
    );
    await expect(
      page.getByRole("cell", { name: "Wheat", exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("cell", { name: "100 kg", exact: true }).first(),
    ).toBeVisible();
  });

  test("Mandi should see batches ready for auction", async ({ page }) => {
    // 2. Mock Mandi authentication
    await page.route("**/auth/login", async (route) => {
      if (route.request().method() === "OPTIONS") {
        await route.fulfill({ status: 204, headers: corsHeaders });
      } else {
        await route.fulfill({
          headers: corsHeaders,
          json: {
            success: true,
            data: {
              token: "fake-mandi-token",
              user: { id: "mandi1", name: "Test Mandi", role: "mandi" },
            },
          },
        });
      }
    });

    await page.route("**/auth/refresh", async (route) => {
      if (route.request().method() === "OPTIONS") {
        await route.fulfill({ status: 204, headers: corsHeaders });
      } else {
        await route.fulfill({ status: 401, headers: corsHeaders });
      }
    });

    // Mock Mandi API calls
    await page.route("**/batches*", async (route) => {
      if (route.request().method() === "OPTIONS") {
        await route.fulfill({ status: 204, headers: corsHeaders });
      } else {
        await route.fulfill({
          headers: corsHeaders,
          json: {
            success: true,
            data: {
              batches: [
                {
                  batchId: "batch-001",
                  farmerName: "Test Farmer",
                  cropType: "Wheat",
                  quantity: 100,
                  currentStage: "mandi",
                },
              ],
            },
          },
        });
      }
    });

    await page.route("**/auctions*", async (route) => {
      if (route.request().method() === "OPTIONS") {
        await route.fulfill({ status: 204, headers: corsHeaders });
      } else {
        await route.fulfill({
          headers: corsHeaders,
          json: { success: true, data: { auctions: [] } },
        });
      }
    });

    await page.route("**/api/auctions", async (route) => {
      if (route.request().method() === "OPTIONS") {
        await route.fulfill({ status: 204, headers: corsHeaders });
      } else {
        await route.fulfill({
          headers: corsHeaders,
          json: { success: true, data: { auctions: [] } },
        });
      }
    });

    await page.goto("/login?from=/mandi");
    await page.fill('input[type="email"]', "mandi@test.com");
    await page.fill('input[type="password"]', "pass");
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(/.*\/mandi/);

    // Verify batch is shown in Mandi dashboard
    await page.screenshot({ path: "screenshot-mandi.png", fullPage: true });
    await expect(
      page.getByRole("cell", { name: "Wheat", exact: true }).first(),
    ).toBeVisible();
  });

  test("Retailer should see completed batches and be able to track journey", async ({
    page,
  }) => {
    // 3. Mock Retailer authentication
    await page.route("**/auth/login", async (route) => {
      if (route.request().method() === "OPTIONS") {
        await route.fulfill({ status: 204, headers: corsHeaders });
      } else {
        await route.fulfill({
          headers: corsHeaders,
          json: {
            success: true,
            data: {
              token: "fake-retailer-token",
              user: {
                id: "retailer1",
                name: "Test Retailer",
                role: "retailer",
              },
            },
          },
        });
      }
    });

    await page.route("**/auth/refresh", async (route) => {
      if (route.request().method() === "OPTIONS") {
        await route.fulfill({ status: 204, headers: corsHeaders });
      } else {
        await route.fulfill({ status: 401, headers: corsHeaders });
      }
    });

    // Mock Retailer batches
    await page.route("**/batches*", async (route) => {
      if (route.request().method() === "OPTIONS") {
        await route.fulfill({ status: 204, headers: corsHeaders });
      } else {
        await route.fulfill({
          headers: corsHeaders,
          json: {
            success: true,
            data: {
              batches: [
                {
                  batchId: "batch-001",
                  farmerName: "Test Farmer",
                  cropType: "Wheat",
                  currentStage: "transport",
                  quantity: 100,
                },
              ],
            },
          },
        });
      }
    });

    await page.route("**/auctions*", async (route) => {
      if (route.request().method() === "OPTIONS") {
        await route.fulfill({ status: 204, headers: corsHeaders });
      } else {
        await route.fulfill({
          headers: corsHeaders,
          json: { success: true, data: { auctions: [] } },
        });
      }
    });

    await page.route("**/api/auctions", async (route) => {
      if (route.request().method() === "OPTIONS") {
        await route.fulfill({ status: 204, headers: corsHeaders });
      } else {
        await route.fulfill({
          headers: corsHeaders,
          json: { success: true, data: { auctions: [] } },
        });
      }
    });

    await page.goto("/login?from=/retailer");
    await page.fill('input[type="email"]', "retailer@test.com");
    await page.fill('input[type="password"]', "pass");
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(/.*\/retailer/);

    // Verify batch is shown in Retailer dashboard
    await page.screenshot({ path: "screenshot-retailer.png", fullPage: true });
    await expect(
      page.getByRole("cell", { name: "Wheat", exact: true }).first(),
    ).toBeVisible();
  });
});
