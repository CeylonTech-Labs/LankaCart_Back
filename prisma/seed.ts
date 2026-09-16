import {
  BlogStatus,
  CMSPageStatus,
  CouponType,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  PrismaClient,
  ProductStatus,
  SellerStatus,
  ShippingStatus,
  UserRole
} from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();
const hash = (value: string) => bcrypt.hash(value, 12);
const img = "https://res.cloudinary.com/demo/image/upload/sample.jpg";

const categories = [
  "Electronics",
  "Fashion",
  "Home & Living",
  "Beauty",
  "Grocery",
  "Books",
  "Sports",
  "Baby Care",
  "Automotive",
  "Health",
  "Toys",
  "Office"
];

const brands = ["Apple", "Samsung", "Ceylon Craft", "MAS Active", "Dilmah", "Atlas", "Singer", "Spa Ceylon", "Avirate", "LankaFresh"];

async function main() {
  const admin = await prisma.user.upsert({
    where: { email: "admin@lankacart.lk" },
    update: { role: UserRole.ADMIN, isActive: true },
    create: {
      firstName: "LankaCart",
      lastName: "Admin",
      email: "admin@lankacart.lk",
      phone: "+94770000001",
      passwordHash: await hash("Admin@12345"),
      role: UserRole.ADMIN
    }
  });

  const sellerProfiles = [];
  for (let i = 1; i <= 3; i += 1) {
    const user = await prisma.user.upsert({
      where: { email: `seller${i}@lankacart.lk` },
      update: { role: UserRole.SELLER, isActive: true },
      create: {
        firstName: ["Colombo", "Kandy", "Galle"][i - 1],
        lastName: "Seller",
        email: `seller${i}@lankacart.lk`,
        phone: `+9477000001${i}`,
        passwordHash: await hash("Seller@12345"),
        role: UserRole.SELLER
      }
    });

    const shopName = ["Colombo Tech Store", "Kandy Lifestyle Hub", "Galle Daily Mart"][i - 1];
    const sellerSlug = ["colombo-tech-store", "kandy-lifestyle-hub", "galle-daily-mart"][i - 1];
    const existingSeller = await prisma.sellerProfile.findUnique({ where: { slug: sellerSlug } });
    const seller = existingSeller
      ? await prisma.sellerProfile.update({ where: { id: existingSeller.id }, data: { status: SellerStatus.APPROVED } })
      : await prisma.sellerProfile.create({
          data: {
        userId: user.id,
        shopName,
        slug: sellerSlug,
        description: "Approved LankaCart demo seller with reliable fulfilment.",
        status: SellerStatus.APPROVED,
        businessEmail: `seller${i}@lankacart.lk`,
        businessPhone: `+9477000001${i}`,
        pickupAddress: `${i} Main Street, Sri Lanka`
          }
        });
    sellerProfiles.push(seller);
  }

  const customers = [];
  for (let i = 1; i <= 10; i += 1) {
    const user = await prisma.user.upsert({
      where: { email: `customer${i}@lankacart.lk` },
      update: { role: UserRole.CUSTOMER, isActive: true },
      create: {
        firstName: `Customer`,
        lastName: `${i}`,
        email: `customer${i}@lankacart.lk`,
        phone: `+947700001${String(i).padStart(2, "0")}`,
        passwordHash: await hash("Customer@12345"),
        role: UserRole.CUSTOMER
      }
    });
    const address = await prisma.address.upsert({
      where: { id: `seed-address-${i}` },
      update: {},
      create: {
        id: `seed-address-${i}`,
        userId: user.id,
        fullName: `${user.firstName} ${user.lastName}`,
        phone: user.phone ?? "+94770000000",
        line1: `${i} Lake Road`,
        city: ["Colombo", "Kandy", "Galle", "Jaffna", "Matara"][i % 5],
        province: "Western",
        country: "Sri Lanka",
        isDefault: true
      }
    });
    customers.push({ user, address });
  }

  const categoryRecords = [];
  for (const [index, name] of categories.entries()) {
    categoryRecords.push(
      await prisma.category.upsert({
        where: { slug: slug(name) },
        update: { isActive: true, sortOrder: index },
        create: { name, slug: slug(name), description: `${name} products for Sri Lankan shoppers`, imageUrl: img, sortOrder: index }
      })
    );
  }

  const brandRecords = [];
  for (const name of brands) {
    brandRecords.push(
      await prisma.brand.upsert({
        where: { slug: slug(name) },
        update: { isActive: true },
        create: { name, slug: slug(name), description: `${name} marketplace brand`, logoUrl: img }
      })
    );
  }

  const products = [];
  for (let i = 1; i <= 50; i += 1) {
    const category = categoryRecords[i % categoryRecords.length];
    const brand = brandRecords[i % brandRecords.length];
    const seller = sellerProfiles[i % sellerProfiles.length];
    const price = 1500 + i * 950;
    const product = await prisma.product.upsert({
      where: { slug: `demo-product-${i}` },
      update: { status: ProductStatus.APPROVED, price, discountPrice: i % 4 === 0 ? price - 350 : null },
      create: {
        sellerId: seller.id,
        categoryId: category.id,
        brandId: brand.id,
        name: `${brand.name} ${category.name} Item ${i}`,
        slug: `demo-product-${i}`,
        sku: `LC-DEMO-${String(i).padStart(3, "0")}`,
        shortDescription: `Popular ${category.name.toLowerCase()} item from ${brand.name}.`,
        description: `A portfolio-ready LankaCart sample product with clear specifications, dependable seller support, and island-wide delivery.`,
        price,
        discountPrice: i % 4 === 0 ? price - 350 : undefined,
        compareAtPrice: price + 800,
        status: ProductStatus.APPROVED,
        isFeatured: i <= 12,
        warranty: "6 months seller warranty",
        returnPolicy: "Return eligible within 7 days after delivery.",
        deliveryInfo: "Ships from Sri Lanka within 2-4 working days."
      }
    });
    products.push(product);

    await prisma.productImage.upsert({
      where: { id: `seed-product-image-${i}` },
      update: { productId: product.id, url: img, isPrimary: true },
      create: { id: `seed-product-image-${i}`, productId: product.id, url: img, altText: product.name, isPrimary: true }
    });

    await prisma.inventory.upsert({
      where: { id: `seed-inventory-${i}` },
      update: { productId: product.id, quantity: 20 + (i % 30), lowStockThreshold: 5 },
      create: { id: `seed-inventory-${i}`, productId: product.id, quantity: 20 + (i % 30), lowStockThreshold: 5, warehouseLocation: "Colombo" }
    });
  }

  const couponData = [
    ["WELCOME500", CouponType.FIXED_AMOUNT, 500],
    ["UNI10", CouponType.PERCENTAGE, 10],
    ["FREESHIP", CouponType.FIXED_AMOUNT, 450],
    ["PORTFOLIO15", CouponType.PERCENTAGE, 15],
    ["LC1000", CouponType.FIXED_AMOUNT, 1000]
  ] as const;

  for (const [code, type, discountValue] of couponData) {
    await prisma.coupon.upsert({
      where: { code },
      update: { type, discountValue, isActive: true },
      create: {
        code,
        type,
        discountValue,
        minOrderAmount: 3000,
        maxDiscount: type === CouponType.PERCENTAGE ? 2000 : null,
        usageLimit: 1000,
        startsAt: new Date(Date.now() - 86400000),
        expiresAt: new Date(Date.now() + 86400000 * 90),
        isActive: true
      }
    });
  }

  for (let i = 1; i <= 3; i += 1) {
    await prisma.banner.upsert({
      where: { id: `seed-banner-${i}` },
      update: { title: `LankaCart Deal Banner ${i}`, imageUrl: img, position: i === 1 ? "HOME_HERO" : "HOME_SECTION" },
      create: { id: `seed-banner-${i}`, title: `LankaCart Deal Banner ${i}`, imageUrl: img, linkUrl: "/flash-sale", position: i === 1 ? "HOME_HERO" : "HOME_SECTION", sortOrder: i }
    });
  }

  const flashSale = await prisma.flashSale.upsert({
    where: { slug: "portfolio-flash-sale" },
    update: { isActive: true },
    create: {
      title: "Portfolio Flash Sale",
      slug: "portfolio-flash-sale",
      startsAt: new Date(Date.now() - 3600000),
      endsAt: new Date(Date.now() + 86400000),
      isActive: true
    }
  });

  for (let i = 0; i < 8; i += 1) {
    await prisma.flashSaleProduct.upsert({
      where: { flashSaleId_productId: { flashSaleId: flashSale.id, productId: products[i].id } },
      update: { salePrice: Number(products[i].price) - 500, stockLimit: 20 },
      create: { flashSaleId: flashSale.id, productId: products[i].id, salePrice: Number(products[i].price) - 500, stockLimit: 20 }
    });
  }

  for (let i = 1; i <= 20; i += 1) {
    const customer = customers[i % customers.length];
    const product = products[i % products.length];
    const seller = sellerProfiles.find((item) => item.id === product.sellerId) ?? sellerProfiles[0];
    const status = [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.PROCESSING, OrderStatus.SHIPPED, OrderStatus.DELIVERED][i % 5];
    const existing = await prisma.order.findUnique({ where: { orderNumber: `LC-SEED-${String(i).padStart(4, "0")}` } });
    if (!existing) {
      await prisma.order.create({
        data: {
          orderNumber: `LC-SEED-${String(i).padStart(4, "0")}`,
          userId: customer.user.id,
          shippingAddressId: customer.address.id,
          subtotal: Number(product.discountPrice ?? product.price),
          shippingFee: 450,
          discountAmount: i % 3 === 0 ? 300 : 0,
          totalAmount: Number(product.discountPrice ?? product.price) + 450 - (i % 3 === 0 ? 300 : 0),
          status,
          paymentStatus: status === OrderStatus.DELIVERED ? PaymentStatus.PAID : PaymentStatus.PENDING,
          items: {
            create: {
              productId: product.id,
              sellerId: seller.id,
              productName: product.name,
              sellerShopName: seller.shopName,
              sku: product.sku,
              quantity: 1,
              unitPrice: product.discountPrice ?? product.price,
              totalPrice: product.discountPrice ?? product.price,
              commissionRate: seller.commissionRate,
              status
            }
          },
          payment: { create: { method: i % 2 === 0 ? PaymentMethod.CASH_ON_DELIVERY : PaymentMethod.BANK_TRANSFER, status: status === OrderStatus.DELIVERED ? PaymentStatus.PAID : PaymentStatus.PENDING, amount: Number(product.discountPrice ?? product.price) + 450 } },
          shipping: { create: { addressId: customer.address.id, status: status === OrderStatus.DELIVERED ? ShippingStatus.DELIVERED : ShippingStatus.IN_TRANSIT, trackingNumber: `TRK-SEED-${i}` } },
          statusHistory: { create: { status, note: "Seed order status", changedById: admin.id } }
        }
      });
    }
  }

  const pages = [
    ["about", "About Us"],
    ["contact", "Contact Us"],
    ["privacy-policy", "Privacy Policy"],
    ["terms", "Terms and Conditions"],
    ["return-policy", "Return Policy"],
    ["refund-policy", "Refund Policy"],
    ["seller-policy", "Seller Policy"]
  ];

  for (const [slugValue, title] of pages) {
    await prisma.cMSPage.upsert({
      where: { slug: slugValue },
      update: { status: CMSPageStatus.PUBLISHED },
      create: { authorId: admin.id, title, slug: slugValue, content: `${title} content for the LankaCart university marketplace project.`, status: CMSPageStatus.PUBLISHED, publishedAt: new Date() }
    });
  }

  for (let i = 1; i <= 5; i += 1) {
    await prisma.blog.upsert({
      where: { slug: `lankacart-blog-${i}` },
      update: { status: BlogStatus.PUBLISHED },
      create: {
        authorId: admin.id,
        title: `LankaCart Marketplace Guide ${i}`,
        slug: `lankacart-blog-${i}`,
        excerpt: "A short marketplace article for the demo blog.",
        content: "This article demonstrates LankaCart CMS, blog publishing, and public content rendering.",
        coverUrl: img,
        status: BlogStatus.PUBLISHED,
        publishedAt: new Date()
      }
    });
  }

  console.log("Seed completed", {
    admin: "admin@lankacart.lk / Admin@12345",
    sellers: "seller1@seller2@seller3 pattern / Seller@12345",
    customers: "customer1@lankacart.lk ... customer10@lankacart.lk / Customer@12345",
    products: products.length
  });
}

function slug(value: string) {
  return value.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
