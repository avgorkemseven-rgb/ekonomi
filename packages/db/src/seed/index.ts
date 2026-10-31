/* eslint-disable no-console */
import { hash } from '@node-rs/argon2';
import { PrismaClient, type Prisma } from '@prisma/client';
import { buildListingSearchText, slugify, DEFAULT_LISTING_EXPIRY_DAYS } from '@kleps/shared';
import { BRANDS, CATEGORY_TREE, type SeedCategory } from './catalog';

const prisma = new PrismaClient();
const isProduction = process.env.NODE_ENV === 'production';

async function seedCategory(node: SeedCategory, parentId: string | null, sortOrder: number): Promise<void> {
  const category = await prisma.category.upsert({
    where: { slug: node.slug },
    update: { name: node.name, icon: node.icon ?? null, parentId, sortOrder, translations: { en: node.en } },
    create: { slug: node.slug, name: node.name, icon: node.icon ?? null, parentId, sortOrder, translations: { en: node.en } },
  });
  for (const [i, attr] of (node.attributes ?? []).entries()) {
    const data = {
      label: attr.label,
      type: attr.type,
      options: attr.options ?? [],
      unit: attr.unit ?? null,
      required: attr.required ?? false,
      filterable: attr.filterable ?? false,
      sortOrder: i,
    };
    await prisma.categoryAttribute.upsert({
      where: { categoryId_key: { categoryId: category.id, key: attr.key } },
      update: data,
      create: { ...data, key: attr.key, categoryId: category.id },
    });
  }
  for (const [i, child] of (node.children ?? []).entries()) {
    await seedCategory(child, category.id, i);
  }
}

async function seedBrands(): Promise<void> {
  const categories = await prisma.category.findMany({ select: { id: true, slug: true } });
  const bySlug = new Map(categories.map((c) => [c.slug, c.id]));
  for (const b of BRANDS) {
    const slug = slugify(b.name);
    const connect = b.categories.map((s) => {
      const id = bySlug.get(s);
      if (!id) throw new Error(`Unknown category ${s} for brand ${b.name}`);
      return { id };
    });
    const brand = await prisma.brand.upsert({
      where: { slug },
      update: { name: b.name, categories: { set: connect } },
      create: { slug, name: b.name, categories: { connect } },
    });
    for (const [modelName, categorySlug] of b.models ?? []) {
      const modelSlug = slugify(modelName);
      await prisma.productModel.upsert({
        where: { brandId_slug: { brandId: brand.id, slug: modelSlug } },
        update: { name: modelName, categoryId: bySlug.get(categorySlug) ?? null },
        create: { brandId: brand.id, slug: modelSlug, name: modelName, categoryId: bySlug.get(categorySlug) ?? null },
      });
    }
  }
}

async function seedAdmin(): Promise<void> {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    console.info('SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set — skipping admin user.');
    return;
  }
  if (isProduction && (password.length < 16 || password.startsWith('change-me'))) {
    throw new Error('Refusing to seed a production admin with a weak/default password.');
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.user.update({ where: { email }, data: { role: 'ADMIN' } });
    console.info(`Admin exists: ${email} (role ensured, password unchanged)`);
    return;
  }
  await prisma.user.create({
    data: {
      email,
      username: 'kleps.admin',
      displayName: 'KLEPS Yönetim',
      role: 'ADMIN',
      passwordHash: await hash(password),
      emailVerifiedAt: new Date(),
    },
  });
  console.info(`Admin created: ${email}`);
}

interface DemoListing {
  seller: string;
  category: string;
  brand?: string;
  model?: string;
  title: string;
  description: string;
  priceTl: number;
  condition: 'NEW' | 'LIKE_NEW' | 'GOOD' | 'FAIR';
  city: string;
  district?: string;
  attributes: Prisma.InputJsonObject;
  allowsShipping?: boolean;
}

const DEMO_LISTINGS: DemoListing[] = [
  {
    seller: 'kaan.bilardo',
    category: 'bilardo-istakalari',
    brand: 'predator',
    model: 'revo-12-4',
    title: 'Predator REVO 12.4 karbon şaftlı oyun istakası',
    description: 'Az kullanılmış, düz ve çiziksiz. Orijinal kutusu ve faturası mevcut. Uni-Loc bağlantı, Kamui uç takılı.',
    priceTl: 42500,
    condition: 'LIKE_NEW',
    city: 'İstanbul',
    district: 'Kadıköy',
    attributes: { gameType: 'Amerikan (Pool)', cueType: 'Oyun istakası', tipSize: 12.4, weight: 19, pieces: 'İki parça', shaftType: 'Karbon', jointType: 'Uni-Loc', includesCase: false },
    allowsShipping: true,
  },
  {
    seller: 'kaan.bilardo',
    category: 'bilardo-istakalari',
    brand: 'mezz',
    model: 'power-break-kai',
    title: 'Mezz Power Break Kai kırma istakası',
    description: 'Turnuvalarda kullanıldı, performans kaybı yok. Kırma ucu yeni değiştirildi. Kılıfı ile birlikte.',
    priceTl: 18000,
    condition: 'GOOD',
    city: 'İstanbul',
    district: 'Beşiktaş',
    attributes: { gameType: 'Amerikan (Pool)', cueType: 'Kırma istakası', tipSize: 13, weight: 19.5, pieces: 'İki parça', includesCase: true },
  },
  {
    seller: 'kaan.bilardo',
    category: 'bilardo-toplari',
    brand: 'aramith',
    model: 'tournament',
    title: 'Aramith Tournament pool top seti 57,2 mm',
    description: 'Tam set, tüm toplar mevcut. Kulüp kapanışı nedeniyle satılık. Temiz ve parlak.',
    priceTl: 6500,
    condition: 'GOOD',
    city: 'Ankara',
    district: 'Çankaya',
    attributes: { gameType: 'Amerikan (Pool)', setType: 'Tam set', ballDiameter: '57,2 mm' },
    allowsShipping: true,
  },
  {
    seller: 'ece.dart',
    category: 'dart-oklari',
    brand: 'target',
    model: 'power-9five',
    title: 'Target Power 9Five 23 gr çelik uçlu dart seti',
    description: 'Phil Taylor serisi, %97 tungsten. Yedek flight ve shaftlar ile birlikte gönderilir.',
    priceTl: 5200,
    condition: 'LIKE_NEW',
    city: 'İzmir',
    district: 'Bornova',
    attributes: { tipType: 'Çelik uç (steel)', weight: 23, material: '%97 Tungsten', setCount: 3 },
    allowsShipping: true,
  },
  {
    seller: 'ece.dart',
    category: 'dart-tahtalari',
    brand: 'winmau',
    model: 'blade-6',
    title: 'Winmau Blade 6 kıl dart tahtası',
    description: 'Yaklaşık 3 aylık, sayılar döndürülerek kullanıldı. Ev kullanımı, temiz.',
    priceTl: 3900,
    condition: 'GOOD',
    city: 'İzmir',
    attributes: { boardType: 'Kıl (sisal)', hasCabinet: false },
  },
  {
    seller: 'ece.dart',
    category: 'dart-aksesuarlari',
    brand: 'l-style',
    title: 'L-Style Champagne flight seti — sıfır, 10 paket',
    description: 'Kutusunda sıfır ürünler. Toplu satış, ayrı ayrı da satılır. Kargo alıcıya aittir.',
    priceTl: 1500,
    condition: 'NEW',
    city: 'Bursa',
    attributes: { accessoryType: 'Flight (kanat)' },
    allowsShipping: true,
  },
];

async function seedDemo(): Promise<void> {
  if (isProduction) {
    console.info('Demo data is never seeded in production.');
    return;
  }
  const passwordHash = await hash(process.env.SEED_DEMO_PASSWORD ?? 'DemoKleps123');
  const sellers = [
    { username: 'kaan.bilardo', email: 'kaan@demo.kleps.local', displayName: 'Kaan Bilardo', city: 'İstanbul' },
    { username: 'ece.dart', email: 'ece@demo.kleps.local', displayName: 'Ece Dart', city: 'İzmir' },
  ];
  for (const s of sellers) {
    await prisma.user.upsert({
      where: { username: s.username },
      update: {},
      create: { ...s, passwordHash, bio: 'Demo satıcı hesabı (yalnızca geliştirme ortamı).' },
    });
  }
  const now = Date.now();
  for (const [i, d] of DEMO_LISTINGS.entries()) {
    const seller = await prisma.user.findUniqueOrThrow({ where: { username: d.seller } });
    const exists = await prisma.listing.findFirst({ where: { sellerId: seller.id, title: d.title } });
    if (exists) continue;
    const category = await prisma.category.findUniqueOrThrow({ where: { slug: d.category }, include: { parent: true } });
    const brand = d.brand ? await prisma.brand.findUnique({ where: { slug: d.brand } }) : null;
    const model = brand && d.model
      ? await prisma.productModel.findUnique({ where: { brandId_slug: { brandId: brand.id, slug: d.model } } })
      : null;
    const publishedAt = new Date(now - i * 3_600_000);
    await prisma.listing.create({
      data: {
        sellerId: seller.id,
        categoryId: category.id,
        brandId: brand?.id ?? null,
        modelId: model?.id ?? null,
        title: d.title,
        slug: slugify(d.title),
        description: d.description,
        priceAmount: d.priceTl * 100,
        condition: d.condition,
        city: d.city,
        district: d.district ?? null,
        attributes: d.attributes,
        allowsShipping: d.allowsShipping ?? false,
        allowsInPerson: true,
        status: 'ACTIVE',
        publishedAt,
        expiresAt: new Date(publishedAt.getTime() + DEFAULT_LISTING_EXPIRY_DAYS * 86_400_000),
        searchText: buildListingSearchText({
          title: d.title,
          description: d.description,
          brandName: brand?.name,
          modelName: model?.name,
          categoryNames: [category.parent?.name ?? '', category.name],
          attributeValues: Object.values(d.attributes).filter((v): v is string => typeof v === 'string'),
        }),
      },
    });
  }
  console.info(`Demo data ensured: ${sellers.length} sellers, ${DEMO_LISTINGS.length} listings.`);
}

async function main(): Promise<void> {
  for (const [i, root] of CATEGORY_TREE.entries()) await seedCategory(root, null, i);
  console.info('Categories & attributes seeded.');
  await seedBrands();
  console.info('Brands & models seeded.');
  await seedAdmin();
  if (process.env.SEED_DEMO === 'true') await seedDemo();
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
