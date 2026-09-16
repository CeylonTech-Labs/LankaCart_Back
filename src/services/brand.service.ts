import { prisma } from "../config/prisma";
import { AppError } from "../utils/errors";
import { slugify } from "../utils/slug";

type BrandInput = {
  name?: string;
  slug?: string;
  description?: string;
  logoUrl?: string;
  isActive?: boolean;
};

export const listBrands = async () => {
  return prisma.brand.findMany({
    where: { deletedAt: null, isActive: true },
    include: {
      _count: {
        select: { products: true }
      }
    },
    orderBy: { name: "asc" }
  });
};

export const createBrand = async (input: BrandInput) => {
  if (!input.name) {
    throw new AppError("Brand name is required", 400);
  }

  return prisma.brand.create({
    data: {
      name: input.name,
      slug: input.slug ? slugify(input.slug) : slugify(input.name),
      description: input.description,
      logoUrl: input.logoUrl,
      isActive: input.isActive ?? true
    }
  });
};

export const updateBrand = async (id: string, input: BrandInput) => {
  return prisma.brand.update({
    where: { id },
    data: {
      ...input,
      slug: input.slug ? slugify(input.slug) : undefined
    }
  });
};

export const deleteBrand = async (id: string) => {
  await prisma.brand.update({
    where: { id },
    data: {
      isActive: false,
      deletedAt: new Date()
    }
  });
};
