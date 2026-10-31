import { normalizeTurkish } from './turkish';

/** Builds the normalized, denormalized text that keyword search runs against. */
export function buildListingSearchText(input: {
  title: string;
  description?: string | null;
  brandName?: string | null;
  modelName?: string | null;
  categoryNames?: string[];
  attributeValues?: (string | number | boolean)[];
}): string {
  const parts = [
    input.title,
    input.brandName ?? '',
    input.modelName ?? '',
    ...(input.categoryNames ?? []),
    ...(input.attributeValues ?? []).filter((v) => typeof v === 'string'),
    (input.description ?? '').slice(0, 1000),
  ];
  return normalizeTurkish(parts.join(' ')).slice(0, 2000);
}
