import { prisma } from "../config/prisma";
import { AppError } from "../utils/errors";

type AddressInput = {
  fullName?: string;
  phone?: string;
  line1?: string;
  line2?: string;
  city?: string;
  district?: string;
  province?: string;
  postalCode?: string;
  country?: string;
  isDefault?: boolean;
};

export const listCustomerAddresses = async (userId: string) => {
  return prisma.address.findMany({
    where: {
      userId,
      deletedAt: null
    },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }]
  });
};

export const createCustomerAddress = async (userId: string, input: Required<AddressInput>) => {
  return prisma.$transaction(async (tx) => {
    const db = tx as unknown as typeof prisma;

    if (input.isDefault) {
      await db.address.updateMany({
        where: { userId, deletedAt: null },
        data: { isDefault: false }
      });
    }

    return db.address.create({
      data: {
        ...input,
        userId
      }
    });
  });
};

export const updateCustomerAddress = async (userId: string, addressId: string, input: AddressInput) => {
  await ensureAddressOwner(userId, addressId);

  return prisma.$transaction(async (tx) => {
    const db = tx as unknown as typeof prisma;

    if (input.isDefault) {
      await db.address.updateMany({
        where: { userId, deletedAt: null },
        data: { isDefault: false }
      });
    }

    return db.address.update({
      where: { id: addressId },
      data: input
    });
  });
};

export const deleteCustomerAddress = async (userId: string, addressId: string) => {
  await ensureAddressOwner(userId, addressId);

  await prisma.address.update({
    where: { id: addressId },
    data: {
      isDefault: false,
      deletedAt: new Date()
    }
  });
};

export const setDefaultCustomerAddress = async (userId: string, addressId: string) => {
  await ensureAddressOwner(userId, addressId);

  return prisma.$transaction(async (tx) => {
    const db = tx as unknown as typeof prisma;

    await db.address.updateMany({
      where: { userId, deletedAt: null },
      data: { isDefault: false }
    });

    return db.address.update({
      where: { id: addressId },
      data: { isDefault: true }
    });
  });
};

const ensureAddressOwner = async (userId: string, addressId: string) => {
  const address = await prisma.address.findFirst({
    where: {
      id: addressId,
      userId,
      deletedAt: null
    }
  });

  if (!address) {
    throw new AppError("Address was not found", 404);
  }

  return address;
};
