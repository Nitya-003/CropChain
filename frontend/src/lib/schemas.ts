import { z } from "zod";

/**
 * Zod validation schema for Crop Batch Creation Form
 */
export const batchFormSchema = z.object({
  farmerName: z
    .string()
    .min(1, { message: "Farmer name is required" })
    .max(100, { message: "Farmer name cannot exceed 100 characters" }),
  farmerAddress: z
    .string()
    .min(1, { message: "Farmer address is required" })
    .max(200, { message: "Address cannot exceed 200 characters" }),
  cropType: z
    .string()
    .min(1, { message: "Please select a crop type" }),
  quantity: z
    .string()
    .min(1, { message: "Quantity is required" })
    .refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
      message: "Quantity must be a positive number greater than 0",
    }),
  harvestDate: z
    .string()
    .min(1, { message: "Harvest date is required" })
    .refine((val) => new Date(val) <= new Date(), {
      message: "Harvest date cannot be in the future",
    }),
  origin: z
    .string()
    .min(1, { message: "Origin location is required" }),
  certifications: z.string().optional(),
  description: z.string().max(500, { message: "Description cannot exceed 500 characters" }).optional(),
});

export type BatchFormInput = z.infer<typeof batchFormSchema>;

/**
 * Zod validation schema for Authentication Login Form
 */
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, { message: "Email address is required" })
    .email({ message: "Invalid email address format" }),
  password: z
    .string()
    .min(6, { message: "Password must be at least 6 characters" }),
});

export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Zod validation schema for User Registration Form
 */
export const registerSchema = z.object({
  name: z
    .string()
    .min(2, { message: "Name must be at least 2 characters" }),
  email: z
    .string()
    .min(1, { message: "Email is required" })
    .email({ message: "Invalid email format" }),
  password: z
    .string()
    .min(6, { message: "Password must be at least 6 characters" }),
  role: z.enum(["farmer", "mandi", "transporter", "retailer", "admin"], {
    message: "Please select a valid role",
  }),
});

export type RegisterInput = z.infer<typeof registerSchema>;

/**
 * Zod validation schema for Batch Stage Updates
 */
export const updateStageSchema = z.object({
  stage: z.enum(["farmer", "mandi", "transporter", "retailer"]),
  location: z.string().min(1, { message: "Location is required" }),
  notes: z.string().optional(),
});

export type UpdateStageInput = z.infer<typeof updateStageSchema>;
