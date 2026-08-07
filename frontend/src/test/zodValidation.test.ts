import { describe, it, expect } from "vitest";
import {
  batchFormSchema,
  loginSchema,
  registerSchema,
  updateStageSchema,
} from "../lib/schemas";

describe("Zod Validation Schemas", () => {
  describe("batchFormSchema", () => {
    it("should validate a correct crop batch form payload", () => {
      const validPayload = {
        farmerName: "Rajesh Kumar",
        farmerAddress: "Village Sonipat, Haryana",
        cropType: "wheat",
        quantity: "500",
        harvestDate: "2026-08-01",
        origin: "Sonipat Mandi",
        certifications: "Organic Grade A",
        description: "Freshly harvested golden wheat",
      };

      const result = batchFormSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it("should fail when farmerName or farmerAddress is empty", () => {
      const invalidPayload = {
        farmerName: "",
        farmerAddress: "",
        cropType: "wheat",
        quantity: "500",
        harvestDate: "2026-08-01",
        origin: "Sonipat",
      };

      const result = batchFormSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
      if (!result.success) {
        const issues = result.error.issues.map((i) => i.message);
        expect(issues).toContain("Farmer name is required");
        expect(issues).toContain("Farmer address is required");
      }
    });

    it("should fail when quantity is non-positive or non-numeric", () => {
      const invalidPayload = {
        farmerName: "Rajesh Kumar",
        farmerAddress: "Sonipat",
        cropType: "wheat",
        quantity: "-10",
        harvestDate: "2026-08-01",
        origin: "Sonipat",
      };

      const result = batchFormSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it("should fail when harvestDate is in the future", () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const invalidPayload = {
        farmerName: "Rajesh Kumar",
        farmerAddress: "Sonipat",
        cropType: "wheat",
        quantity: "100",
        harvestDate: futureDate.toISOString().split("T")[0],
        origin: "Sonipat",
      };

      const result = batchFormSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
      if (!result.success) {
        const issues = result.error.issues.map((i) => i.message);
        expect(issues).toContain("Harvest date cannot be in the future");
      }
    });
  });

  describe("loginSchema", () => {
    it("should reject invalid email and short password", () => {
      const result = loginSchema.safeParse({ email: "invalid-email", password: "123" });
      expect(result.success).toBe(false);
    });

    it("should accept valid email and password", () => {
      const result = loginSchema.safeParse({ email: "farmer@cropchain.io", password: "securepassword123" });
      expect(result.success).toBe(true);
    });
  });

  describe("registerSchema", () => {
    it("should validate valid role choices", () => {
      const result = registerSchema.safeParse({
        name: "Amit Patel",
        email: "amit@cropchain.io",
        password: "password123",
        role: "farmer",
      });
      expect(result.success).toBe(true);
    });
  });
});
