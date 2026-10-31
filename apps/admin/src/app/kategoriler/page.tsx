'use client';
import type { AdminCategory } from '@kleps/api-client';
import { ATTRIBUTE_TYPES, type AttributeType } from '@kleps/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAdmin } from '@/components/AdminShell';
import { Alert, Badge, Button, Card, Field, Input, Select, Spinner } from '@/components/ui';
import { browserApi, errorMessage } from '@/lib/browser-api';
import { t } from '@/lib/i18n';

function flattenTree(list: AdminCategory[]): { c: AdminCategory; depth: number }[] {
  const byParent = new Map<string | null, AdminCategory[]>();
  for (const c of list) byParent.set(c.parentId, [...(byParent.get(c.parentId) ?? []), c]);
  const out: { c: AdminCategory; depth: number }[] = [];
  const walk = (parent: string | null, depth: number) => {
    for (const c of (byParent.get(parent) ?? []).sort((a, b) => a.sortOrder - b.sortOrder)) {
      out.push({ c, depth });
      walk(c.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

export default function CategoriesPage() {
  const { user } = useAdmin();
  const isAdmin = user?.role === 'ADMIN';
  const [list, setList] = useState<AdminCategory[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setList(await browserApi.admin.categories());
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);
  useEffect(() => void load(), [load]);

  const rows = useMemo(() => (list ? flattenTree(list) : []), [list]);
  const selected = list?.find((c) => c.id === selectedId) ?? null;

  async function run(fn: () => Promise<unknown>, msg: string) {
    setError(null);
    setNotice(null);
    try {
      await fn();
      setNotice(msg);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  if (!list) return error ? <Alert>{error}</Alert> : <Spinner />;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">{t('admin.categories')}</h1>
      {!isAdmin && <Alert tone="info">Kategori düzenleme yalnızca ADMIN rolüne açıktır.</Alert>}
      {error && <Alert>{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}
      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <Card className="space-y-4">
          <ul className="divide-y divide-line" aria-label="Kategori ağacı">
            {rows.map(({ c, depth }) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  aria-current={selectedId === c.id}
                  className={`flex w-full items-center justify-between py-2 text-left text-sm hover:text-accent ${selectedId === c.id ? 'font-semibold text-accent' : ''}`}
                  style={{ paddingLeft: depth * 18 }}
                >
                  <span>{depth > 0 && '└ '}{c.name} <span className="text-xs text-fg-muted">/{c.slug}</span></span>
                  <span className="flex gap-1">
                    {!c.isActive && <Badge tone="danger">pasif</Badge>}
                    <Badge>{c.listingCount}</Badge>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {isAdmin && (
            <form
              className="space-y-3 border-t border-line pt-4"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                const form = e.currentTarget;
                void run(
                  () => browserApi.admin.createCategory({ name: String(f.get('name')), parentId: (f.get('parentId') as string) || null }),
                  'Kategori oluşturuldu.',
                ).then(() => form.reset());
              }}
            >
              <h2 className="font-semibold">Yeni kategori</h2>
              <Field label="Ad" htmlFor="new-name"><Input id="new-name" name="name" required minLength={2} maxLength={60} /></Field>
              <Field label="Üst kategori" htmlFor="new-parent" optional>
                <Select id="new-parent" name="parentId" defaultValue="">
                  <option value="">(kök)</option>
                  {rows.map(({ c, depth }) => <option key={c.id} value={c.id}>{'— '.repeat(depth)}{c.name}</option>)}
                </Select>
              </Field>
              <Button type="submit">Oluştur</Button>
            </form>
          )}
        </Card>

        {selected ? (
          <Card className="space-y-5">
            <form
              key={selected.id}
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void run(
                  () => browserApi.admin.updateCategory(selected.id, {
                    name: String(f.get('name')),
                    slug: String(f.get('slug')),
                    sortOrder: Number(f.get('sortOrder')),
                    isActive: f.get('isActive') === 'on',
                  }),
                  'Kategori güncellendi.',
                );
              }}
            >
              <h2 className="font-semibold">{selected.name}</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Ad" htmlFor="c-name"><Input id="c-name" name="name" defaultValue={selected.name} disabled={!isAdmin} /></Field>
                <Field label="Slug" htmlFor="c-slug"><Input id="c-slug" name="slug" defaultValue={selected.slug} disabled={!isAdmin} /></Field>
                <Field label="Sıra" htmlFor="c-sort"><Input id="c-sort" name="sortOrder" type="number" min={0} defaultValue={selected.sortOrder} disabled={!isAdmin} /></Field>
                <label className="flex items-center gap-2 self-end pb-3 text-sm">
                  <input type="checkbox" name="isActive" defaultChecked={selected.isActive} disabled={!isAdmin} /> Aktif
                </label>
              </div>
              {isAdmin && <Button type="submit">{t('common.save')}</Button>}
            </form>

            <div className="space-y-3 border-t border-line pt-4">
              <h3 className="font-semibold">Özellikler (bu kategoriye ait; üst kategorilerinkiler miras alınır)</h3>
              {selected.attributes.length === 0 ? <p className="text-sm text-fg-muted">Özellik yok.</p> : (
                <ul className="space-y-2 text-sm">
                  {selected.attributes.map((a) => (
                    <li key={a.id} className="flex items-center justify-between rounded-lg bg-muted px-3 py-2">
                      <span>
                        <strong>{a.label}</strong> <code className="text-xs">{a.key}</code> · {a.type}
                        {a.unit && ` (${a.unit})`} {a.required && <Badge tone="warning">zorunlu</Badge>} {a.filterable && <Badge tone="accent">filtre</Badge>}
                        {a.options.length > 0 && <span className="block text-xs text-fg-muted">{a.options.join(', ')}</span>}
                      </span>
                      {isAdmin && (
                        <Button variant="ghost" onClick={() => { if (confirm(`${a.label} silinsin mi?`)) void run(() => browserApi.admin.deleteAttribute(a.id), 'Özellik silindi.'); }}>
                          {t('common.delete')}
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {isAdmin && <AttributeForm onSubmit={(input) => run(() => browserApi.admin.createAttribute(selected.id, input), 'Özellik eklendi.')} />}
            </div>
          </Card>
        ) : (
          <Card><p className="text-sm text-fg-muted">Düzenlemek için bir kategori seçin.</p></Card>
        )}
      </div>
    </div>
  );
}

function AttributeForm({ onSubmit }: { onSubmit: (input: { key: string; label: string; type: AttributeType; options: string[]; unit: string | null; required: boolean; filterable: boolean; sortOrder: number }) => Promise<void> }) {
  const [type, setType] = useState<AttributeType>('SELECT');
  return (
    <form
      className="grid gap-3 rounded-xl border border-line p-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const f = new FormData(form);
        void onSubmit({
          key: String(f.get('key')),
          label: String(f.get('label')),
          type,
          options: String(f.get('options') ?? '').split(',').map((s) => s.trim()).filter(Boolean),
          unit: (f.get('unit') as string) || null,
          required: f.get('required') === 'on',
          filterable: f.get('filterable') === 'on',
          sortOrder: 100,
        }).then(() => form.reset());
      }}
    >
      <h4 className="text-sm font-semibold sm:col-span-2">Yeni özellik</h4>
      <Field label="Anahtar (camelCase)" htmlFor="a-key"><Input id="a-key" name="key" required pattern="[a-z][a-zA-Z0-9]*" /></Field>
      <Field label="Etiket" htmlFor="a-label"><Input id="a-label" name="label" required /></Field>
      <Field label="Tip" htmlFor="a-type">
        <Select id="a-type" value={type} onChange={(e) => setType(e.target.value as AttributeType)}>
          {ATTRIBUTE_TYPES.map((x) => <option key={x}>{x}</option>)}
        </Select>
      </Field>
      <Field label="Birim" htmlFor="a-unit" optional><Input id="a-unit" name="unit" maxLength={12} /></Field>
      {type === 'SELECT' && (
        <div className="sm:col-span-2">
          <Field label="Seçenekler (virgülle ayırın)" htmlFor="a-options"><Input id="a-options" name="options" required /></Field>
        </div>
      )}
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="required" /> Zorunlu</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="filterable" /> Filtrelenebilir</label>
      <Button type="submit" className="sm:col-span-2">Ekle</Button>
    </form>
  );
}
