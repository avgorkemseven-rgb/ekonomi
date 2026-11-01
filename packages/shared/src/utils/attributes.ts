import type { AttributeType } from '../enums';
import type { AttributeValues } from '../schemas/listing';

export interface AttributeDefinition {
  key: string;
  label: string;
  type: AttributeType;
  options: string[];
  required: boolean;
}

export interface AttributeIssue {
  key: string;
  code: 'unknown' | 'required' | 'type' | 'option';
}

/**
 * Validates listing attribute values against category definitions.
 * `requireAll` enforces required attributes (publish time); drafts may be incomplete.
 * Returns cleaned values (unknown keys removed, numeric strings coerced) and issues.
 */
export function validateAttributes(
  defs: AttributeDefinition[],
  values: AttributeValues,
  requireAll: boolean,
): { values: AttributeValues; issues: AttributeIssue[] } {
  const issues: AttributeIssue[] = [];
  const cleaned: AttributeValues = {};
  const byKey = new Map(defs.map((d) => [d.key, d]));

  for (const key of Object.keys(values)) {
    if (!byKey.has(key)) issues.push({ key, code: 'unknown' });
  }

  for (const def of defs) {
    const raw = values[def.key];
    const empty = raw === undefined || raw === null || raw === '';
    if (empty) {
      if (requireAll && def.required) issues.push({ key: def.key, code: 'required' });
      continue;
    }
    switch (def.type) {
      case 'NUMBER': {
        const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw.replace(',', '.')) : NaN;
        if (!Number.isFinite(n)) issues.push({ key: def.key, code: 'type' });
        else cleaned[def.key] = n;
        break;
      }
      case 'BOOLEAN': {
        if (typeof raw === 'boolean') cleaned[def.key] = raw;
        else if (raw === 'true' || raw === 'false') cleaned[def.key] = raw === 'true';
        else issues.push({ key: def.key, code: 'type' });
        break;
      }
      case 'SELECT': {
        if (typeof raw !== 'string') issues.push({ key: def.key, code: 'type' });
        else if (!def.options.includes(raw)) issues.push({ key: def.key, code: 'option' });
        else cleaned[def.key] = raw;
        break;
      }
      case 'TEXT': {
        if (typeof raw !== 'string') issues.push({ key: def.key, code: 'type' });
        else cleaned[def.key] = raw.trim();
        break;
      }
    }
  }
  return { values: cleaned, issues };
}
