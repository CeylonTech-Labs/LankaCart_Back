import { z } from "zod";

export const userIdParamSchema = z.object({
  params: z.object({
    id: z.string().min(1, "User id is required")
  })
});

export const updateUserStatusSchema = z.object({
  params: z.object({
    id: z.string().min(1, "User id is required")
  }),
  body: z.object({
    isActive: z.boolean()
  })
});

export const sellerIdParamSchema = z.object({
  params: z.object({
    id: z.string().min(1, "Seller id is required")
  })
});

export const rejectSellerSchema = z.object({
  params: z.object({
    id: z.string().min(1, "Seller id is required")
  }),
  body: z.object({
    reason: z.string().trim().max(500).optional()
  })
});
