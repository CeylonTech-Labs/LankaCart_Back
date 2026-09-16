import { z } from "zod";

export const addressIdParamSchema = z.object({
  params: z.object({
    id: z.string().min(1, "Address id is required")
  })
});

export const createAddressSchema = z.object({
  body: z.object({
    fullName: z.string().trim().min(1, "Full name is required"),
    phone: z.string().trim().min(7, "Phone number is required").max(20),
    line1: z.string().trim().min(1, "Address line 1 is required"),
    line2: z.string().trim().optional(),
    city: z.string().trim().min(1, "City is required"),
    district: z.string().trim().optional(),
    province: z.string().trim().optional(),
    postalCode: z.string().trim().optional(),
    country: z.string().trim().default("Sri Lanka"),
    isDefault: z.boolean().default(false)
  })
});

export const updateAddressSchema = z.object({
  params: z.object({
    id: z.string().min(1, "Address id is required")
  }),
  body: createAddressSchema.shape.body.partial()
});
