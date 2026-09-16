import { SellerStatus, UserRole } from "@prisma/client";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/errors";
import { comparePassword, hashPassword } from "../utils/password";
import { signAccessToken, signRefreshToken } from "../utils/jwt";

type RegisterInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
};

type LoginInput = {
  email: string;
  password: string;
};

type SellerRegisterInput = RegisterInput & {
  businessName: string;
  businessType: string;
  storeName: string;
  storeDescription: string;
  pickupAddress: string;
  bankName: string;
  accountHolderName: string;
  accountNumber: string;
  branchName: string;
};

type UpdateProfileInput = {
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatarUrl?: string;
  storeName?: string;
  storeDescription?: string;
  pickupAddress?: string;
};

type ChangePasswordInput = {
  currentPassword: string;
  newPassword: string;
};

export const sanitizeUser = <T extends { passwordHash?: string }>(user: T) => {
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

const createTokens = (user: { id: string; email: string; role: UserRole }) => {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role
  };

  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload)
  };
};

export const registerCustomer = async (input: RegisterInput) => {
  const user = await prisma.user.create({
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email.toLowerCase(),
      phone: input.phone,
      passwordHash: await hashPassword(input.password),
      role: UserRole.CUSTOMER,
      cart: {
        create: {}
      }
    }
  });

  return {
    user: sanitizeUser(user),
    tokens: createTokens(user)
  };
};

export const registerSeller = async (input: SellerRegisterInput) => {
  const slug = `${slugify(input.storeName)}-${Date.now().toString(36)}`;
  const passwordHash = await hashPassword(input.password);

  const user = await prisma.$transaction(async (tx) => {
    const db = tx as unknown as typeof prisma;

    return db.user.create({
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email.toLowerCase(),
        phone: input.phone,
        passwordHash,
        role: UserRole.SELLER,
        sellerProfile: {
          create: {
            businessName: input.businessName,
            businessType: input.businessType,
            shopName: input.storeName,
            slug,
            description: input.storeDescription,
            status: SellerStatus.PENDING,
            businessEmail: input.email.toLowerCase(),
            businessPhone: input.phone,
            businessAddress: input.pickupAddress,
            pickupAddress: input.pickupAddress,
            bankAccounts: {
              create: {
                bankName: input.bankName,
                accountName: input.accountHolderName,
                accountNumber: input.accountNumber,
                branchName: input.branchName,
                isDefault: true
              }
            }
          }
        }
      },
      include: {
        sellerProfile: {
          include: {
            bankAccounts: true
          }
        }
      }
    });
  });

  return {
    user: sanitizeUser(user),
    tokens: createTokens(user)
  };
};

export const loginUser = async (input: LoginInput) => {
  const user = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
    include: {
      sellerProfile: true
    }
  });

  if (!user || user.deletedAt || !user.isActive) {
    throw new AppError("Invalid email or password", 401);
  }

  const passwordMatches = await comparePassword(input.password, user.passwordHash);

  if (!passwordMatches) {
    throw new AppError("Invalid email or password", 401);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() }
  });

  return {
    user: sanitizeUser(user),
    tokens: createTokens(user)
  };
};

export const getCurrentUser = async (userId: string) => {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      deletedAt: null
    },
    include: {
      addresses: {
        where: { deletedAt: null },
        orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }]
      },
      sellerProfile: {
        include: {
          bankAccounts: {
            where: { deletedAt: null }
          }
        }
      }
    }
  });

  if (!user) {
    throw new AppError("User profile was not found", 404);
  }

  return sanitizeUser(user);
};

export const updateCurrentUser = async (userId: string, input: UpdateProfileInput) => {
  const { storeName, storeDescription, pickupAddress, ...userInput } = input;

  const user = await prisma.$transaction(async (tx) => {
    const db = tx as unknown as typeof prisma;

    const updatedUser = await db.user.update({
      where: { id: userId },
      data: userInput
    });

    if (storeName || storeDescription || pickupAddress) {
      const sellerProfile = await db.sellerProfile.findUnique({
        where: { userId }
      });

      if (!sellerProfile) {
        throw new AppError("Seller profile was not found", 404);
      }

      await db.sellerProfile.update({
        where: { userId },
        data: {
          shopName: storeName,
          description: storeDescription,
          pickupAddress,
          businessAddress: pickupAddress
        }
      });
    }

    return updatedUser;
  });

  return sanitizeUser(user);
};

export const changeCurrentUserPassword = async (userId: string, input: ChangePasswordInput) => {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      deletedAt: null
    }
  });

  if (!user) {
    throw new AppError("User profile was not found", 404);
  }

  const passwordMatches = await comparePassword(input.currentPassword, user.passwordHash);

  if (!passwordMatches) {
    throw new AppError("Current password is incorrect", 400);
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash: await hashPassword(input.newPassword)
    }
  });
};

export const registerUser = async (input: RegisterInput & { role?: UserRole }) => {
  if (input.role === UserRole.SELLER) {
    throw new AppError("Use the seller registration endpoint", 400);
  }

  return registerCustomer(input);
};
