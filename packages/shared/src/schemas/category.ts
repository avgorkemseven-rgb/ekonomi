import { z } from 'zod';
import { ATTRIBUTE_TYPES, type AttributeType } from '../enums';

export interface CategoryAttributeDto {
  id: string;
  key: string;
  label: string;
  type: AttributeType;
  options: string[];
  unit: string | null;
  required: boolean;
  filterable: boolean;
  sortOrder: number;
}

export interface CategoryNodeDto {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  parentId: string | null;
  sortOrder: number;
  children: CategoryNodeDto[];
}

export interface BrandDto {
  id: string;
  slug: string;
  name: string;
}

export interface ProductModelDto {
  id: string;
  slug: string;
  name: string;
  brandId: string;
}

export interface CategoryDetailDto {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  parentId: string | null;
  /** Root → … → this category. */
  path: { id: string; slug: string; name: string }[];
  children: { id: string; slug: string; name: string; icon: string | null }[];
  /** Own attributes plus all ancestors' attributes. */
  attributes: CategoryAttributeDto[];
  brands: BrandDto[];
  isLeaf: boolean;
}

const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'validation.slugFormat');

export const attributeKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .regex(/^[a-z][a-zA-Z0-9]*$/, 'validation.attributeKeyFormat');

export const categoryCreateSchema = z.object({
  name: z.string().trim().min(2).max(60),
  slug: slugSchema.optional(),
  parentId: z.string().min(1).nullable().optional(),
  icon: z.string().trim().max(40).nullable().optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
  isActive: z.boolean().optional(),
});
export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>;

export const categoryUpdateSchema = categoryCreateSchema.partial();
export type CategoryUpdateInput = z.infer<typeof categoryUpdateSchema>;

export const attributeCreateSchema = z
  .object({
    key: attributeKeySchema,
    label: z.string().trim().min(1).max(60),
    type: z.enum(ATTRIBUTE_TYPES),
    options: z.array(z.string().trim().min(1).max(60)).max(50).default([]),
    unit: z.string().trim().max(12).nullable().optional(),
    required: z.boolean().default(false),
    filterable: z.boolean().default(false),
    sortOrder: z.number().int().min(0).max(1000).default(0),
  })
  .refine((v) => v.type !== 'SELECT' || v.options.length > 0, {
    message: 'validation.selectNeedsOptions',
    path: ['options'],
  });
export type AttributeCreateInput = z.infer<typeof attributeCreateSchema>;

export const attributeUpdateSchema = z.object({
  label: z.string().trim().min(1).max(60).optional(),
  options: z.array(z.string().trim().min(1).max(60)).max(50).optional(),
  unit: z.string().trim().max(12).nullable().optional(),
  required: z.boolean().optional(),
  filterable: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(1000).optional(),
});
export type AttributeUpdateInput = z.infer<typeof attributeUpdateSchema>;
