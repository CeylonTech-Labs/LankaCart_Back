import { ProductStatus } from "@prisma/client";
import { z } from "zod";

export const idParamSchema = z.object({
  params: z.object({
    id: z.string().min(1, "Id is required")
  })
});

export const slugParamSchema = z.object({
  params: z.object({
    slug: z.string().min(1, "Slug is required")
  })
});

export const imageIdParamSchema = z.object({
  params: z.object({
    imageId: z.string().min(1, "Image id is required")
  })
});

export const categorySlugParamSchema = z.object({
  params: z.object({
    categorySlug: z.string().min(1, "Category slug is required")
  })
});

export const productQuerySchema = z.object({
  query: z.object({
    q: z.string().optional(),
    keyword: z.string().optional(),
    category: z.string().optional(),
    brand: z.string().optional(),
    minPrice: z.coerce.number().min(0).optional(),
    maxPrice: z.coerce.number().min(0).optional(),
    rating: z.coerce.number().min(1).max(5).optional(),
    seller: z.string().optional(),
    sort: z.enum(["latest", "price_asc", "price_desc", "popular"]).default("latest"),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(60).default(12)
  })
});

export const createCategorySchema = z.object({
  body: z.object({
    name: z.string().trim().min(1),
    slug: z.string().trim().min(1).optional(),
    parentId: z.string().optional(),
    description: z.string().optional(),
    imageUrl: z.string().url().optional(),
    isActive: z.boolean().default(true),
    sortOrder: z.number().int().default(0)
  })
});

export const updateCategorySchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: createCategorySchema.shape.body.partial()
});

export const createBrandSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1),
    slug: z.string().trim().min(1).optional(),
    description: z.string().optional(),
    logoUrl: z.string().url().optional(),
    isActive: z.boolean().default(true)
  })
});

export const updateBrandSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: createBrandSchema.shape.body.partial()
});

const productVariantSchema = z.object({
  sku: z.string().trim().min(1),
  name: z.string().trim().min(1),
  optionName: z.string().trim().min(1),
  optionValue: z.string().trim().min(1),
  priceAdjustment: z.coerce.number().default(0),
  stock: z.coerce.number().int().min(0).default(0),
  imageUrl: z.string().url().optional()
});

const productAttributeSchema = z.object({
  name: z.string().trim().min(1),
  value: z.string().trim().min(1)
});

export const createProductSchema = z.object({
  body: z.object({
    title: z.string().trim().min(1),
    slug: z.string().trim().min(1).optional(),
    shortDescription: z.string().optional(),
    description: z.string().trim().min(10),
    price: z.coerce.number().positive(),
    discountPrice: z.coerce.number().positive().optional(),
    stock: z.coerce.number().int().min(0),
    sku: z.string().trim().min(1),
    categoryId: z.string().min(1),
    brandId: z.string().min(1),
    warranty: z.string().optional(),
    returnPolicy: z.string().optional(),
    deliveryInfo: z.string().optional(),
    variants: z.array(productVariantSchema).default([]),
    attributes: z.array(productAttributeSchema).default([])
  })
});

export const updateProductSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: createProductSchema.shape.body.partial().extend({
    status: z.nativeEnum(ProductStatus).optional(),
    isFeatured: z.boolean().optional()
  })
});

export const cartItemSchema = z.object({
  body: z.object({
    productId: z.string().min(1),
    variantId: z.string().optional(),
    quantity: z.coerce.number().int().min(1).default(1)
  })
});

export const updateCartItemSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    quantity: z.coerce.number().int().min(1)
  })
});
