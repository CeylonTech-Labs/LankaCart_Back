import { ProductStatus } from "@prisma/client";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/errors";

export const getCart = async (userId: string) => {
  const cart = await prisma.cart.upsert({
    where: { userId },
    update: {},
    create: { userId },
    include: {
      items: {
        include: {
          product: {
            include: {
              images: true,
              seller: true
            }
          },
          variant: true
        },
        orderBy: { createdAt: "desc" }
      }
    }
  });

  const subtotal = cart.items.reduce((sum, item) => sum + Number(item.unitPrice) * item.quantity, 0);

  return {
    ...cart,
    subtotal
  };
};

export const addCartItem = async (userId: string, input: { productId: string; variantId?: string; quantity: number }) => {
  const product = await prisma.product.findFirst({
    where: {
      id: input.productId,
      status: ProductStatus.APPROVED,
      deletedAt: null
    }
  });

  if (!product) {
    throw new AppError("Product was not found", 404);
  }

  const cart = await prisma.cart.upsert({
    where: { userId },
    update: {},
    create: { userId }
  });

  const unitPrice = product.discountPrice ?? product.price;

  const existingItem = await prisma.cartItem.findFirst({
    where: {
      cartId: cart.id,
      productId: input.productId,
      variantId: input.variantId
    }
  });

  if (existingItem) {
    await prisma.cartItem.update({
      where: { id: existingItem.id },
      data: {
        quantity: {
          increment: input.quantity
        }
      }
    });
  } else {
    await prisma.cartItem.create({
      data: {
      cartId: cart.id,
      productId: input.productId,
      variantId: input.variantId,
      quantity: input.quantity,
      unitPrice
      }
    });
  }

  return getCart(userId);
};

export const updateCartItem = async (userId: string, itemId: string, quantity: number) => {
  await ensureCartItemOwner(userId, itemId);
  await prisma.cartItem.update({
    where: { id: itemId },
    data: { quantity }
  });

  return getCart(userId);
};

export const removeCartItem = async (userId: string, itemId: string) => {
  await ensureCartItemOwner(userId, itemId);
  await prisma.cartItem.delete({ where: { id: itemId } });
  return getCart(userId);
};

export const clearCart = async (userId: string) => {
  const cart = await prisma.cart.findUnique({ where: { userId } });

  if (cart) {
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  }

  return getCart(userId);
};

const ensureCartItemOwner = async (userId: string, itemId: string) => {
  const item = await prisma.cartItem.findFirst({
    where: {
      id: itemId,
      cart: { userId }
    }
  });

  if (!item) {
    throw new AppError("Cart item was not found", 404);
  }

  return item;
};
