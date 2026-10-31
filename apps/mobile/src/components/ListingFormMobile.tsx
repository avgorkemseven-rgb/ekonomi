import { ApiError } from '@kleps/api-client';
import {
  LISTING_CONDITIONS,
  PROVINCES,
  tlToKurus,
  type CategoryDetailDto,
  type ListingCondition,
  type ListingCreateInput,
  type ListingDetailDto,
  type ProductModelDto,
} from '@kleps/shared';
import { useEffect, useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { api } from '../api';
import { errorMessage, fieldError, t } from '../i18n';
import { spacing, useTheme } from '../theme';
import { Banner, Button, ErrorView, Field, Input, Loading, Picker } from './ui';

export function ListingFormMobile({ categorySlug, listing, submitLabel, onSaved }: { categorySlug: string; listing?: ListingDetailDto; submitLabel: string; onSaved: (l: ListingDetailDto) => void }) {
  const c = useTheme();
  const [category, setCategory] = useState<CategoryDetailDto | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [models, setModels] = useState<ProductModelDto[]>([]);
  const [title, setTitle] = useState(listing?.title ?? '');
  const [brandId, setBrandId] = useState(listing?.brand?.id ?? '');
  const [modelId, setModelId] = useState(listing?.model?.id ?? '');
  const [condition, setCondition] = useState<ListingCondition | ''>(listing?.condition ?? '');
  const [price, setPrice] = useState(listing?.priceAmount != null ? String(listing.priceAmount / 100).replace('.', ',') : '');
  const [city, setCity] = useState(listing?.city ?? '');
  const [district, setDistrict] = useState(listing?.district ?? '');
  const [description, setDescription] = useState(listing?.description ?? '');
  const [attrs, setAttrs] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(listing?.attributes ?? {}).map(([k, v]) => [k, String(v)])));
  const [allowsInPerson, setAllowsInPerson] = useState(listing?.allowsInPerson ?? true);
  const [allowsShipping, setAllowsShipping] = useState(listing?.allowsShipping ?? false);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.categories.detail(categorySlug).then(setCategory, (e: unknown) => setLoadError(errorMessage(e)));
  }, [categorySlug]);
  useEffect(() => {
    if (!brandId || !category) return setModels([]);
    api.brands.models(brandId, category.id).then(setModels, () => setModels([]));
  }, [brandId, category]);

  if (loadError) return <ErrorView message={loadError} />;
  if (!category) return <Loading />;

  const attrErr = (key: string) =>
    error instanceof ApiError && error.issues?.some((i) => i.path[0] === 'attributes' && i.path[1] === key) ? t('validation.invalid') : undefined;

  async function submit() {
    setError(null);
    const priceAmount = price.trim() ? tlToKurus(price) : null;
    if (price.trim() && priceAmount === null) {
      setError(new ApiError(400, 'VALIDATION_ERROR', 'price', [{ path: ['priceAmount'], message: 'validation.invalid' }]));
      return;
    }
    const attributes: Record<string, string | number | boolean> = {};
    for (const def of category!.attributes) {
      const v = attrs[def.key]?.trim();
      if (!v) continue;
      attributes[def.key] = def.type === 'NUMBER' ? Number(v.replace(',', '.')) : def.type === 'BOOLEAN' ? v === 'true' : v;
    }
    const payload: ListingCreateInput = {
      categoryId: category!.id,
      title,
      description,
      brandId: brandId || null,
      modelId: modelId || null,
      priceAmount,
      condition: condition || null,
      city: (city || null) as ListingCreateInput['city'],
      district: district || null,
      attributes,
      allowsInPerson,
      allowsShipping,
    };
    setBusy(true);
    try {
      onSaved(listing ? await api.listings.update(listing.id, payload) : await api.listings.create(payload));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: spacing.lg }}>
      {error != null && <Banner text={errorMessage(error)} />}
      <Text style={{ color: c.textMuted }}>{category.path.map((p) => p.name).join(' › ')}</Text>
      <Field label={t('listing.title')} error={fieldError(error, 'title')}>
        <Input value={title} onChangeText={setTitle} maxLength={100} accessibilityLabel={t('listing.title')} />
      </Field>
      <Picker label={t('listing.brand')} value={brandId} options={category.brands.map((b) => ({ value: b.id, label: b.name }))} onChange={(v) => { setBrandId(v); setModelId(''); }} />
      {models.length > 0 && <Picker label={t('listing.model')} value={modelId} options={models.map((m) => ({ value: m.id, label: m.name }))} onChange={setModelId} />}
      <Picker label={t('listing.condition')} value={condition} error={fieldError(error, 'condition')} options={LISTING_CONDITIONS.map((x) => ({ value: x, label: t(`listing.conditions.${x}`) }))} onChange={setCondition} />
      <Field label={t('sell.priceTl')} error={fieldError(error, 'priceAmount')}>
        <Input value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="ör. 12.500" accessibilityLabel={t('sell.priceTl')} />
      </Field>
      <Picker label={t('listing.city')} value={city} error={fieldError(error, 'city')} options={PROVINCES.map((p) => ({ value: p, label: p }))} onChange={setCity} />
      <Field label={`${t('listing.district')} (${t('common.optional')})`}>
        <Input value={district} onChangeText={setDistrict} maxLength={60} accessibilityLabel={t('listing.district')} />
      </Field>
      {category.attributes.map((def) => {
        const label = `${def.label}${def.unit ? ` (${def.unit})` : ''}${def.required ? '' : ` (${t('common.optional')})`}`;
        const set = (v: string) => setAttrs((a) => ({ ...a, [def.key]: v }));
        if (def.type === 'SELECT') return <Picker key={def.key} label={label} value={attrs[def.key] ?? ''} error={attrErr(def.key)} options={def.options.map((o) => ({ value: o, label: o }))} onChange={set} />;
        if (def.type === 'BOOLEAN') return <Picker key={def.key} label={label} value={attrs[def.key] ?? ''} options={[{ value: 'true', label: t('common.yes') }, { value: 'false', label: t('common.no') }]} onChange={set} />;
        return (
          <Field key={def.key} label={label} error={attrErr(def.key)}>
            <Input value={attrs[def.key] ?? ''} onChangeText={set} keyboardType={def.type === 'NUMBER' ? 'decimal-pad' : 'default'} accessibilityLabel={def.label} />
          </Field>
        );
      })}
      <Field label={t('listing.description')} error={fieldError(error, 'description')}>
        <Input value={description} onChangeText={setDescription} multiline maxLength={5000} accessibilityLabel={t('listing.description')} />
      </Field>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: c.text }}>{t('listing.allowsInPerson')}</Text>
        <Switch value={allowsInPerson} onValueChange={setAllowsInPerson} accessibilityLabel={t('listing.allowsInPerson')} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: c.text }}>{t('listing.allowsShipping')}</Text>
        <Switch value={allowsShipping} onValueChange={setAllowsShipping} accessibilityLabel={t('listing.allowsShipping')} />
      </View>
      <Button title={submitLabel} onPress={() => void submit()} loading={busy} />
    </View>
  );
}
