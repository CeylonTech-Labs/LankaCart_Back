import { UserRole } from "@prisma/client";
import { z } from "zod";

const passwordSchema = z.string().min(8, "Password must be at least 8 characters");

export const customerRegisterSchema = z.object({
  body: z.object({
    firstName: z.string().trim().min(1, "First name is required"),
    lastName: z.string().trim().min(1, "Last name is required"),
    email: z.string().trim().email("Valid email is required"),
    phone: z.string().trim().min(7, "Phone number is required").max(20),
    password: passwordSchema
  })
});

export const sellerRegisterSchema = z.object({
  body: z.object({
    firstName: z.string().trim().min(1, "First name is required"),
    lastName: z.string().trim().min(1, "Last name is required"),
    email: z.string().trim().email("Valid email is required"),
    phone: z.string().trim().min(7, "Phone number is required").max(20),
    password: passwordSchema,
    businessName: z.string().trim().min(1, "Business name is required"),
    businessType: z.string().trim().min(1, "Business type is required"),
    storeName: z.string().trim().min(1, "Store name is required"),
    storeDescription: z.string().trim().min(10, "Store description must be at least 10 characters"),
    pickupAddress: z.string().trim().min(5, "Pickup address is required"),
    bankName: z.string().trim().min(1, "Bank name is required"),
    accountHolderName: z.string().trim().min(1, "Account holder name is required"),
    accountNumber: z.string().trim().min(4, "Account number is required"),
    branchName: z.string().trim().min(1, "Branch name is required")
  })
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().trim().email("Valid email is required"),
    password: z.string().min(1, "Password is required")
  })
});

export const updateProfileSchema = z.object({
  body: z.object({
    firstName: z.string().trim().min(1).optional(),
    lastName: z.string().trim().min(1).optional(),
    phone: z.string().trim().min(7).max(20).optional(),
    avatarUrl: z.string().url().optional(),
    storeName: z.string().trim().min(1).optional(),
    storeDescription: z.string().trim().min(10).optional(),
    pickupAddress: z.string().trim().min(5).optional()
  })
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: passwordSchema
  })
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().trim().email("Valid email is required")
  })
});

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(1, "Reset token is required"),
    password: passwordSchema
  })
});

export const registerSchema = z.object({
  body: z.object({
    firstName: z.string().trim().min(1),
    lastName: z.string().trim().min(1),
    email: z.string().trim().email(),
    phone: z.string().trim().min(7).max(20).optional(),
    password: passwordSchema,
    role: z.enum([UserRole.CUSTOMER, UserRole.SELLER]).default(UserRole.CUSTOMER)
  })
});
