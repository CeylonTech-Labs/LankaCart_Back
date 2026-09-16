import { ProductStatus } from "@prisma/client";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/errors";

export const getWishlist = async (userId: string) => {
  return prisma.wishlist.findMany({
    where: { userId },
    include: {
      product: {
        include: {
          images: true,
          brand: true,
          category: true,
          seller: true,
          reviews: true
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });
};

export const addWishlistItem = async (userId: string, productId: string) => {
  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      status: ProductStatus.APPROVED,
      deletedAt: null
    }
  });

  if (!product) {
    throw new AppError("Product was not found", 404);
  }

  return prisma.wishlist.upsert({
    where: {
      userId_productId: {
        userId,
        productId
      }
    },
    update: {},
    create: {
      userId,
      productId
    }
  });
};

export const removeWishlistItem = async (userId: string, productId: string) => {
  await prisma.wishlist.deleteMany({
    where: {
      userId,
      productId
    }
  });
};
