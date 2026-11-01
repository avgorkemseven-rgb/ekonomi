'use client';
import { PROVINCES } from '@kleps/shared';
import { useState } from 'react';
import { RequireAuth } from '@/components/RequireAuth';
import { useSession } from '@/components/SessionProvider';
import { Alert, Button, Card, Field, Input, LinkButton, Select, Textarea } from '@/components/ui';
import { browserApi, errorMessage, fieldError } from '@/lib/browser-api';
import { t } from '@/lib/i18n';

function Account() {
  const { user, setUser } = useSession();
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [city, setCity] = useState(user?.city ?? '');
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  if (!user) return null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      setUser(await browserApi.me.update({ displayName, bio: bio || null, city: (city || null) as never }));
      setSaved(true);
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('account.title')}</h1>
        <LinkButton href={`/satici/${user.username}`} variant="secondary">{t('listing.sellerProfile')}</LinkButton>
      </div>
      <Card>
        <form onSubmit={onSubmit} className="space-y-4">
          {error != null && <Alert>{errorMessage(error)}</Alert>}
          {saved && <Alert tone="success">{t('account.profileSaved')}</Alert>}
          <p className="text-sm text-fg-muted">{user.email} · @{user.username}</p>
          <Field label={t('auth.displayName')} htmlFor="displayName" error={fieldError(error, 'displayName')}>
            <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </Field>
          <Field label={t('listing.city')} htmlFor="city" optional>
            <Select id="city" value={city} onChange={(e) => setCity(e.target.value)}>
              <option value="">{t('sell.selectPlaceholder')}</option>
              {PROVINCES.map((p) => <option key={p}>{p}</option>)}
            </Select>
          </Field>
          <Field label={t('account.bio')} htmlFor="bio" optional>
            <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={500} />
          </Field>
          <Button type="submit" loading={saving}>{t('common.save')}</Button>
        </form>
      </Card>
    </div>
  );
}

export default function AccountPage() {
  return (
    <RequireAuth>
      <Account />
    </RequireAuth>
  );
}
