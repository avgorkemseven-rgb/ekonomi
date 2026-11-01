'use client';
import type { CategoryAttributeDto, CategoryDetailDto, ListingCreateInput, ListingDetailDto, ProductModelDto } from '@kleps/shared';
import { LISTING_CONDITIONS, PROVINCES, tlToKurus } from '@kleps/shared';
import { useEffect, useState } from 'react';
import { ApiError, browserApi, errorMessage, fieldError } from '@/lib/browser-api';
import { t } from '@/lib/i18n';
import { Alert, Button, Field, Input, Select, Spinner, Textarea } from './ui';

type AttrState = Record<string, string>;

function initialAttrs(listing?: ListingDetailDto): AttrState {
  const out: AttrState = {};
  for (const [k, v] of Object.entries(listing?.attributes ?? {})) out[k] = String(v);
  return out;
}

function attributePayload(defs: CategoryAttributeDto[], values: AttrState): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const def of defs) {
    const v = values[def.key]?.trim();
    if (!v) continue;
    if (def.type === 'NUMBER') out[def.key] = Number(v.replace(',', '.'));
    else if (def.type === 'BOOLEAN') out[def.key] = v === 'true';
    else out[def.key] = v;
  }
  return out;
}

export function ListingForm({
  categorySlug,
  listing,
  submitLabel,
  onSaved,
}: {
  categorySlug: string;
  listing?: ListingDetailDto;
  submitLabel: string;
  onSaved: (listing: ListingDetailDto) => void;
}) {
  const [category, setCategory] = useState<CategoryDetailDto | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [models, setModels] = useState<ProductModelDto[]>([]);
  const [title, setTitle] = useState(listing?.title ?? '');
  const [brandId, setBrandId] = useState(listing?.brand?.id ?? '');
  const [modelId, setModelId] = useState(listing?.model?.id ?? '');
  const [condition, setCondition] = useState(listing?.condition ?? '');
  const [price, setPrice] = useState(listing?.priceAmount != null ? String(listing.priceAmount / 100).replace('.', ',') : '');
  const [city, setCity] = useState(listing?.city ?? '');
  const [district, setDistrict] = useState(listing?.district ?? '');
  const [description, setDescription] = useState(listing?.description ?? '');
  const [attrs, setAttrs] = useState<AttrState>(initialAttrs(listing));
  const [allowsInPerson, setAllowsInPerson] = useState(listing?.allowsInPerson ?? true);
  const [allowsShipping, setAllowsShipping] = useState(listing?.allowsShipping ?? false);
  const [error, setError] = useState<unknown>(null);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    browserApi.categories.detail(categorySlug).then(setCategory, (e: unknown) => setLoadError(errorMessage(e)));
  }, [categorySlug]);

  useEffect(() => {
    if (!brandId || !category) {
      setModels([]);
      return;
    }
    browserApi.brands.models(brandId, category.id).then(setModels, () => setModels([]));
  }, [brandId, category]);

  if (loadError) return <Alert>{loadError}</Alert>;
  if (!category) return <div className="flex justify-center py-10 text-accent"><Spinner /></div>;

  const fe = (field: string) => fieldError(error, field);
  const attrError = (key: string) => {
    if (!(error instanceof ApiError)) return undefined;
    const issue = error.issues?.find((i) => i.path[0] === 'attributes' && i.path[1] === key);
    return issue ? (issue.message === 'attribute.required' ? t('validation.required') : t('validation.invalid')) : undefined;
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setPriceError(null);
    const priceAmount = price.trim() ? tlToKurus(price) : null;
    if (price.trim() && priceAmount === null) {
      setPriceError(t('validation.invalid'));
      return;
    }
    const payload: ListingCreateInput = {
      categoryId: category!.id,
      title,
      description,
      brandId: brandId || null,
      modelId: modelId || null,
      priceAmount,
      condition: (condition || null) as ListingCreateInput['condition'],
      city: (city || null) as ListingCreateInput['city'],
      district: district || null,
      attributes: attributePayload(category!.attributes, attrs),
      allowsInPerson,
      allowsShipping,
    };
    setSaving(true);
    try {
      const result = listing ? await browserApi.listings.update(listing.id, payload) : await browserApi.listings.create(payload);
      setSaved(true);
      onSaved(result);
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate aria-label={t('sell.stepDetails')}>
      {error != null && <Alert>{errorMessage(error)}</Alert>}
      {saved && <Alert tone="success">{t('sell.draftSaved')}</Alert>}
      <p className="text-sm text-fg-muted">
        {t('listing.category')}: <strong className="text-fg">{category.path.map((p) => p.name).join(' › ')}</strong>
      </p>
      <Field label={t('listing.title')} htmlFor="title" error={fe('title')}>
        <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} required invalid={!!fe('title')} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('listing.brand')} htmlFor="brandId" error={fe('brandId')} optional>
          <Select id="brandId" value={brandId} onChange={(e) => { setBrandId(e.target.value); setModelId(''); }}>
            <option value="">{t('sell.selectPlaceholder')}</option>
            {category.brands.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </Select>
        </Field>
        <Field label={t('listing.model')} htmlFor="modelId" error={fe('modelId')} optional>
          <Select id="modelId" value={modelId} onChange={(e) => setModelId(e.target.value)} disabled={!models.length}>
            <option value="">{t('sell.selectPlaceholder')}</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </Select>
        </Field>
        <Field label={t('listing.condition')} htmlFor="condition" error={fe('condition')}>
          <Select id="condition" value={condition} onChange={(e) => setCondition(e.target.value as typeof condition)} invalid={!!fe('condition')}>
            <option value="">{t('sell.selectPlaceholder')}</option>
            {LISTING_CONDITIONS.map((c) => (
              <option key={c} value={c}>{t(`listing.conditions.${c}`)}</option>
            ))}
          </Select>
        </Field>
        <Field label={t('sell.priceTl')} htmlFor="price" error={priceError ?? fe('priceAmount')}>
          <Input id="price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="ör. 12.500" invalid={!!(priceError ?? fe('priceAmount'))} />
        </Field>
        <Field label={t('listing.city')} htmlFor="city" error={fe('city')}>
          <Select id="city" value={city} onChange={(e) => setCity(e.target.value)} invalid={!!fe('city')}>
            <option value="">{t('sell.selectPlaceholder')}</option>
            {PROVINCES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </Select>
        </Field>
        <Field label={t('listing.district')} htmlFor="district" optional>
          <Input id="district" value={district} onChange={(e) => setDistrict(e.target.value)} maxLength={60} />
        </Field>
      </div>

      {category.attributes.length > 0 && (
        <fieldset className="space-y-4 rounded-2xl border border-line p-4">
          <legend className="px-1 text-sm font-semibold">{t('listing.attributes')}</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            {category.attributes.map((def) => {
              const id = `attr-${def.key}`;
              const value = attrs[def.key] ?? '';
              const set = (v: string) => setAttrs((a) => ({ ...a, [def.key]: v }));
              const label = def.unit ? `${def.label} (${def.unit})` : def.label;
              return (
                <Field key={def.key} label={label} htmlFor={id} error={attrError(def.key)} optional={!def.required}>
                  {def.type === 'SELECT' ? (
                    <Select id={id} value={value} onChange={(e) => set(e.target.value)} invalid={!!attrError(def.key)}>
                      <option value="">{t('sell.selectPlaceholder')}</option>
                      {def.options.map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </Select>
                  ) : def.type === 'BOOLEAN' ? (
                    <Select id={id} value={value} onChange={(e) => set(e.target.value)}>
                      <option value="">{t('sell.selectPlaceholder')}</option>
                      <option value="true">{t('common.yes')}</option>
                      <option value="false">{t('common.no')}</option>
                    </Select>
                  ) : (
                    <Input id={id} value={value} onChange={(e) => set(e.target.value)} inputMode={def.type === 'NUMBER' ? 'decimal' : 'text'} invalid={!!attrError(def.key)} />
                  )}
                </Field>
              );
            })}
          </div>
        </fieldset>
      )}

      <Field label={t('listing.description')} htmlFor="description" error={fe('description')} hint="En az 20 karakter. Kusurları ve kutu/aksesuar durumunu belirtin.">
        <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={5000} invalid={!!fe('description')} />
      </Field>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t('listing.delivery')}</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={allowsInPerson} onChange={(e) => setAllowsInPerson(e.target.checked)} className="h-4 w-4 accent-[var(--k-accent)]" />
          {t('listing.allowsInPerson')}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={allowsShipping} onChange={(e) => setAllowsShipping(e.target.checked)} className="h-4 w-4 accent-[var(--k-accent)]" />
          {t('listing.allowsShipping')}
        </label>
      </fieldset>

      <Button type="submit" loading={saving}>{saving ? t('common.saving') : submitLabel}</Button>
    </form>
  );
}
