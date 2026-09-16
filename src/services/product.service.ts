import { Prisma, ProductStatus } from "@prisma/client";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/errors";
import { getPagination, getPaginationMeta } from "../utils/pagination";
import { slugify, uniqueSlug } from "../utils/slug";
import { deleteCloudinaryImage, uploadImageBuffer } from "./upload.service";

type ProductQuery = {
  q?: string;
  keyword?: string;
  category?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  rating?: number;
  seller?: string;
  sort?: "latest" | "price_asc" | "price_desc" | "popular";
  page?: number;
  limit?: number;
};

type ProductInput = {
  title?: string;
  slug?: string;
  shortDescription?: string;
  description?: string;
  price?: number;
  discountPrice?: number;
  stock?: number;
  sku?: string;
  categoryId?: string;
  brandId?: string;
  warranty?: string;
  returnPolicy?: string;
  deliveryInfo?: string;
  variants?: Array<{
    sku: string;
    name: string;
    optionName: string;
    optionValue: string;
    priceAdjustment?: number;
    stock?: number;
    imageUrl?: string;
  }>;
  attributes?: Array<{ name: string; value: string }>;
  status?: ProductStatus;
  isFeatured?: boolean;
};

const productInclude = {
  images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
  variants: true,
  attributes: true,
  inventoryRecords: true,
  category: true,
  brand: true,
  seller: {
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      }
    }
  },
  reviews: true,
  _count: {
    select: {
      orderItems: true,
      reviews: true,
      wishlistItems: true
    }
  }
} satisfies Prisma.ProductInclude;

const approvedWhere = {
  deletedAt: null,
  status: ProductStatus.APPROVED
} satisfies Prisma.ProductWhereInput;

const orderByForSort = (sort: ProductQuery["sort"]): Prisma.ProductOrderByWithRelationInput[] => {
  if (sort === "price_asc") return [{ discountPrice: "asc" }, { price: "asc" }];
  if (sort === "price_desc") return [{ discountPrice: "desc" }, { price: "desc" }];
  if (sort === "popular") return [{ orderItems: { _count: "desc" } }, { createdAt: "desc" }];
  return [{ createdAt: "desc" }];
};

const buildProductWhere = (query: ProductQuery): Prisma.ProductWhereInput => {
  const keyword = query.keyword ?? query.q;
  const priceFilter: Prisma.DecimalFilter | undefined =
    query.minPrice || query.maxPrice
      ? {
          gte: query.minPrice,
          lte: query.maxPrice
        }
      : undefined;

  return {
    ...approvedWhere,
    ...(keyword
      ? {
          OR: [
            { name: { contains: keyword } },
            { shortDescription: { contains: keyword } },
            { description: { contains: keyword } },
            { sku: { contains: keyword } }
          ]
        }
      : {}),
    ...(query.category ? { category: { slug: query.category } } : {}),
    ...(query.brand ? { brand: { slug: query.brand } } : {}),
    ...(query.seller ? { seller: { slug: query.seller } } : {}),
    ...(priceFilter ? { OR: [{ discountPrice: priceFilter }, { price: priceFilter }] } : {}),
    ...(query.rating ? { reviews: { some: { rating: { gte: query.rating }, isApproved: true } } } : {})
  };
};

export const listPublicProducts = async (query: ProductQuery) => {
  const { page, limit, skip, take } = getPagination(query);
  const where = buildProductWhere(query);
  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: productInclude,
      orderBy: orderByForSort(query.sort),
      skip,
      take
    }),
    prisma.product.count({ where })
  ]);

  return {
    products,
    meta: getPaginationMeta(total, page, limit)
  };
};

export const listFeaturedProducts = async () => {
  return prisma.product.findMany({
    where: { ...approvedWhere, isFeatured: true },
    include: productInclude,
    take: 12,
    orderBy: { createdAt: "desc" }
  });
};

export const listNewArrivals = async () => {
  return prisma.product.findMany({
    where: approvedWhere,
    include: productInclude,
    take: 12,
    orderBy: { createdAt: "desc" }
  });
};

export const listTopSelling = async () => {
  return prisma.product.findMany({
    where: approvedWhere,
    include: productInclude,
    take: 12,
    orderBy: [{ orderItems: { _count: "desc" } }, { createdAt: "desc" }]
  });
};

export const getProductBySlug = async (slug: string) => {
  const product = await prisma.product.findFirst({
    where: { slug, deletedAt: null, status: ProductStatus.APPROVED },
    include: productInclude
  });

  if (!product) {
    throw new AppError("Product was not found", 404);
  }

  return product;
};

export const listProductsByCategory = async (categorySlug: string, query: ProductQuery) => {
  return listPublicProducts({ ...query, category: categorySlug });
};

export const getSellerProducts = async (userId: string) => {
  const seller = await getSellerForUser(userId);

  return prisma.product.findMany({
    where: { sellerId: seller.id, deletedAt: null },
    include: productInclude,
    orderBy: { createdAt: "desc" }
  });
};

export const getSellerProduct = async (userId: string, productId: string) => {
  const seller = await getSellerForUser(userId);
  const product = await prisma.product.findFirst({
    where: { id: productId, sellerId: seller.id, deletedAt: null },
    include: productInclude
  });

  if (!product) {
    throw new AppError("Product was not found", 404);
  }

  return product;
};

export const createSellerProduct = async (userId: string, input: Required<ProductInput>) => {
  const seller = await getSellerForUser(userId);
  const slug = input.slug ? slugify(input.slug) : uniqueSlug(input.title);

  return prisma.$transaction(async (tx) => {
    const db = tx as unknown as typeof prisma;
    const product = await db.product.create({
      data: {
        sellerId: seller.id,
        categoryId: input.categoryId,
        brandId: input.brandId,
        name: input.title,
        slug,
        sku: input.sku,
        shortDescription: input.shortDescription,
        description: input.description,
        price: input.price,
        discountPrice: input.discountPrice,
        compareAtPrice: input.discountPrice ? input.price : undefined,
        status: ProductStatus.PENDING,
        warranty: input.warranty,
        returnPolicy: input.returnPolicy,
        deliveryInfo: input.deliveryInfo,
        inventoryRecords: {
          create: {
            quantity: input.stock
          }
        },
        attributes: {
          create: input.attributes ?? []
        },
        variants: {
          create:
            input.variants?.map((variant) => ({
              sku: variant.sku,
              name: variant.name,
              optionName: variant.optionName,
              optionValue: variant.optionValue,
              priceAdjustment: variant.priceAdjustment ?? 0,
              imageUrl: variant.imageUrl
            })) ?? []
        }
      },
      include: productInclude
    });

    if (input.variants?.length) {
      const variants = await db.productVariant.findMany({
        where: { productId: product.id },
        orderBy: { createdAt: "asc" }
      });

      await db.inventory.createMany({
        data: variants.map((variant, index) => ({
          productId: product.id,
          variantId: variant.id,
          quantity: input.variants?.[index]?.stock ?? 0
        }))
      });
    }

    return db.product.findUniqueOrThrow({
      where: { id: product.id },
      include: productInclude
    });
  });
};

export const updateSellerProduct = async (userId: string, productId: string, input: ProductInput) => {
  const seller = await getSellerForUser(userId);
  await getSellerProduct(userId, productId);

  return prisma.$transaction(async (tx) => {
    const db = tx as unknown as typeof prisma;

    if (typeof input.stock === "number") {
      const updated = await db.inventory.updateMany({
        where: {
          productId,
          variantId: null
        },
        data: {
          quantity: input.stock
        }
      });

      if (updated.count === 0) {
        await db.inventory.create({
          data: {
            productId,
            quantity: input.stock
          }
        });
      }
    }

    return db.product.update({
      where: { id: productId },
      data: {
        sellerId: seller.id,
        name: input.title,
        slug: input.slug ? slugify(input.slug) : undefined,
        shortDescription: input.shortDescription,
        description: input.description,
        price: input.price,
        discountPrice: input.discountPrice,
        compareAtPrice: input.discountPrice && input.price ? input.price : undefined,
        sku: input.sku,
        categoryId: input.categoryId,
        brandId: input.brandId,
        warranty: input.warranty,
        returnPolicy: input.returnPolicy,
        deliveryInfo: input.deliveryInfo,
        status: ProductStatus.PENDING
      },
      include: productInclude
    });
  });
};

export const deleteSellerProduct = async (userId: string, productId: string) => {
  await getSellerProduct(userId, productId);
  await softDeleteProduct(productId);
};

export const uploadProductImages = async (userId: string, productId: string, files: Express.Multer.File[]) => {
  await getSellerProduct(userId, productId);

  if (!files.length) {
    throw new AppError("At least one product image is required", 400);
  }

  const uploaded = await Promise.all(files.map((file) => uploadImageBuffer(file.buffer)));
  const existingCount = await prisma.productImage.count({ where: { productId } });

  return prisma.productImage.createMany({
    data: uploaded.map((image, index) => ({
      productId,
      url: image.secure_url,
      publicId: image.public_id,
      sortOrder: existingCount + index,
      isPrimary: existingCount === 0 && index === 0
    }))
  });
};

export const deleteProductImage = async (userId: string, imageId: string) => {
  const image = await prisma.productImage.findUnique({
    where: { id: imageId },
    include: { product: true }
  });

  if (!image) {
    throw new AppError("Image was not found", 404);
  }

  await getSellerProduct(userId, image.productId);
  await deleteCloudinaryImage(image.publicId);
  await prisma.productImage.delete({ where: { id: imageId } });
};

export const listAdminProducts = async (status?: ProductStatus) => {
  return prisma.product.findMany({
    where: { deletedAt: null, status },
    include: productInclude,
    orderBy: { createdAt: "desc" }
  });
};

export const updateAdminProductStatus = async (id: string, status: ProductStatus) => {
  return prisma.product.update({
    where: { id },
    data: { status },
    include: productInclude
  });
};

export const setAdminProductFeatured = async (id: string, isFeatured: boolean) => {
  return prisma.product.update({
    where: { id },
    data: { isFeatured },
    include: productInclude
  });
};

export const deleteAdminProduct = async (id: string) => {
  await softDeleteProduct(id);
};

const softDeleteProduct = async (id: string) => {
  await prisma.product.update({
    where: { id },
    data: {
      status: ProductStatus.INACTIVE,
      deletedAt: new Date()
    }
  });
};

const getSellerForUser = async (userId: string) => {
  const seller = await prisma.sellerProfile.findFirst({
    where: {
      userId,
      deletedAt: null
    }
  });

  if (!seller) {
    throw new AppError("Seller profile was not found", 404);
  }

  return seller;
};
