import { Prisma, ProductStatus, SellerStatus, UserRole } from "@prisma/client";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/errors";
import { sanitizeUser } from "./auth.service";

const userSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  role: true,
  avatarUrl: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  sellerProfile: true
} satisfies Prisma.UserSelect;

export const listUsers = async () => {
  return prisma.user.findMany({
    where: { deletedAt: null },
    select: userSelect,
    orderBy: { createdAt: "desc" }
  });
};

export const getUserById = async (id: string) => {
  const user = await prisma.user.findFirst({
    where: { id, deletedAt: null },
    include: {
      addresses: {
        where: { deletedAt: null }
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
    throw new AppError("User was not found", 404);
  }

  return sanitizeUser(user);
};

export const updateUserStatus = async (id: string, isActive: boolean) => {
  const user = await prisma.user.update({
    where: { id },
    data: { isActive },
    select: userSelect
  });

  return user;
};

export const softDeleteUser = async (id: string) => {
  await prisma.user.update({
    where: { id },
    data: {
      isActive: false,
      deletedAt: new Date()
    }
  });
};

export const listSellers = async (status?: SellerStatus) => {
  return prisma.sellerProfile.findMany({
    where: {
      deletedAt: null,
      status
    },
    include: {
      user: {
        select: userSelect
      },
      bankAccounts: {
        where: { deletedAt: null }
      }
    },
    orderBy: { createdAt: "desc" }
  });
};

export const getSellerById = async (id: string) => {
  const seller = await prisma.sellerProfile.findFirst({
    where: { id, deletedAt: null },
    include: {
      user: {
        select: userSelect
      },
      bankAccounts: {
        where: { deletedAt: null }
      },
      products: {
        take: 10,
        orderBy: { createdAt: "desc" }
      }
    }
  });

  if (!seller) {
    throw new AppError("Seller was not found", 404);
  }

  return seller;
};

export const updateSellerStatus = async (id: string, status: SellerStatus) => {
  const seller = await prisma.sellerProfile.update({
    where: { id },
    data: { status },
    include: {
      user: {
        select: userSelect
      },
      bankAccounts: {
        where: { deletedAt: null }
      }
    }
  });

  if (status === SellerStatus.SUSPENDED) {
    await prisma.user.update({
      where: { id: seller.userId },
      data: { isActive: false }
    });
  }

  if (status === SellerStatus.APPROVED) {
    await prisma.user.update({
      where: { id: seller.userId },
      data: { isActive: true }
    });
  }

  return seller;
};

export const getDashboardStats = async () => {
  const [
    totalUsers,
    totalCustomers,
    totalSellers,
    pendingSellers,
    totalProducts,
    pendingProducts,
    totalOrders,
    revenue
  ] = await Promise.all([
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.user.count({ where: { role: UserRole.CUSTOMER, deletedAt: null } }),
    prisma.sellerProfile.count({ where: { deletedAt: null } }),
    prisma.sellerProfile.count({ where: { status: SellerStatus.PENDING, deletedAt: null } }),
    prisma.product.count({ where: { deletedAt: null } }),
    prisma.product.count({ where: { status: ProductStatus.PENDING, deletedAt: null } }),
    prisma.order.count(),
    prisma.order.aggregate({
      _sum: {
        totalAmount: true
      }
    })
  ]);

  return {
    totalUsers,
    totalCustomers,
    totalSellers,
    pendingSellers,
    totalProducts,
    pendingProducts,
    totalOrders,
    totalRevenue: revenue._sum.totalAmount ?? 0
  };
};
