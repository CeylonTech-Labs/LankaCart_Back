import { prisma } from "../config/prisma";
import { AppError } from "../utils/errors";
import { slugify } from "../utils/slug";

type CategoryInput = {
  name?: string;
  slug?: string;
  parentId?: string;
  description?: string;
  imageUrl?: string;
  isActive?: boolean;
  sortOrder?: number;
};

export const listCategories = async () => {
  return prisma.category.findMany({
    where: { deletedAt: null, isActive: true },
    include: {
      children: {
        where: { deletedAt: null, isActive: true }
      },
      _count: {
        select: { products: true }
      }
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
  });
};

export const getCategoryBySlug = async (slug: string) => {
  const category = await prisma.category.findFirst({
    where: { slug, deletedAt: null },
    include: {
      children: true,
      parent: true,
      products: {
        where: { deletedAt: null, status: "APPROVED" },
        include: {
          images: true,
          brand: true,
          seller: true,
          reviews: true
        },
        take: 12,
        orderBy: { createdAt: "desc" }
      }
    }
  });

  if (!category) {
    throw new AppError("Category was not found", 404);
  }

  return category;
};

export const createCategory = async (input: CategoryInput) => {
  if (!input.name) {
    throw new AppError("Category name is required", 400);
  }

  return prisma.category.create({
    data: {
      name: input.name,
      slug: input.slug ? slugify(input.slug) : slugify(input.name),
      parentId: input.parentId,
      description: input.description,
      imageUrl: input.imageUrl,
      isActive: input.isActive ?? true,
      sortOrder: input.sortOrder ?? 0
    }
  });
};

export const updateCategory = async (id: string, input: CategoryInput) => {
  return prisma.category.update({
    where: { id },
    data: {
      ...input,
      slug: input.slug ? slugify(input.slug) : undefined
    }
  });
};

export const deleteCategory = async (id: string) => {
  await prisma.category.update({
    where: { id },
    data: {
      isActive: false,
      deletedAt: new Date()
    }
  });
};
