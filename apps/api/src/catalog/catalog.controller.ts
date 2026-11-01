import { Controller, Get, Param, Query } from '@nestjs/common';
import type { BrandDto, ProductModelDto } from '@kleps/shared';
import { Errors } from '../common/errors';
import { CategoriesService } from '../categories/categories.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('brands')
export class CatalogController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categories: CategoriesService,
  ) {}

  /** Brands, optionally restricted to a category (and its descendants). */
  @Get()
  async brands(@Query('category') categorySlug?: string): Promise<BrandDto[]> {
    let categoryFilter = {};
    if (typeof categorySlug === 'string' && categorySlug) {
      const category = await this.categories.getVisibleBySlug(categorySlug);
      const ids = await this.categories.descendantIds(category.id);
      categoryFilter = { categories: { some: { id: { in: ids } } } };
    }
    return this.prisma.brand.findMany({
      where: { isActive: true, ...categoryFilter },
      orderBy: { name: 'asc' },
      select: { id: true, slug: true, name: true },
      take: 500,
    });
  }

  @Get(':id/models')
  async models(@Param('id') id: string, @Query('category') categoryId?: string): Promise<ProductModelDto[]> {
    const brand = await this.prisma.brand.findFirst({ where: { id, isActive: true }, select: { id: true } });
    if (!brand) throw Errors.notFound('Brand');
    return this.prisma.productModel.findMany({
      where: {
        brandId: id,
        isActive: true,
        ...(typeof categoryId === 'string' && categoryId ? { OR: [{ categoryId }, { categoryId: null }] } : {}),
      },
      orderBy: { name: 'asc' },
      select: { id: true, slug: true, name: true, brandId: true },
      take: 500,
    });
  }
}
