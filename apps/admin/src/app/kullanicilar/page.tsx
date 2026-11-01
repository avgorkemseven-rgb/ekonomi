'use client';
import type { AdminUser } from '@kleps/api-client';
import type { Paginated } from '@kleps/shared';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, Input, Spinner } from '@/components/ui';
import { browserApi, errorMessage } from '@/lib/browser-api';
import { formatDate } from '@/lib/format';

export default function UsersPage() {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<AdminUser> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await browserApi.admin.users({ q: q || undefined, page, pageSize: 25 }));
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [q, page]);
  useEffect(() => void load(), [load]);

  async function toggle(u: AdminUser) {
    const next = u.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    const reason = next === 'SUSPENDED' ? prompt('Askıya alma gerekçesi') : undefined;
    if (next === 'SUSPENDED' && !reason) return;
    setError(null);
    try {
      await browserApi.admin.setUserStatus(u.id, next, reason ?? undefined);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Kullanıcılar</h1>
      <form onSubmit={(e) => { e.preventDefault(); setPage(1); void load(); }} className="flex gap-2">
        <Input aria-label="Ara" placeholder="E-posta, kullanıcı adı veya ad" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
        <Button type="submit" variant="secondary">Ara</Button>
      </form>
      {error && <Alert>{error}</Alert>}
      {!data ? <Spinner /> : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs text-fg-muted">
              <tr><th className="p-3">Kullanıcı</th><th className="p-3">Rol</th><th className="p-3">İlan</th><th className="p-3">Kayıt</th><th className="p-3">Durum</th><th className="p-3" /></tr>
            </thead>
            <tbody>
              {data.items.map((u) => (
                <tr key={u.id} className="border-t border-line">
                  <td className="p-3"><p className="font-medium">{u.displayName}</p><p className="text-xs text-fg-muted">@{u.username} · {u.email}</p></td>
                  <td className="p-3">{u.role}</td>
                  <td className="p-3">{u._count.listings}</td>
                  <td className="p-3">{formatDate(u.createdAt)}</td>
                  <td className="p-3"><Badge tone={u.status === 'ACTIVE' ? 'success' : 'danger'}>{u.status === 'ACTIVE' ? 'Aktif' : 'Askıda'}</Badge></td>
                  <td className="p-3 text-right">
                    {u.role !== 'ADMIN' && <Button variant={u.status === 'ACTIVE' ? 'danger' : 'secondary'} onClick={() => void toggle(u)}>{u.status === 'ACTIVE' ? 'Askıya al' : 'Etkinleştir'}</Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && data.totalPages > 1 && (
        <div className="flex justify-center gap-3">
          <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Önceki</Button>
          <Button variant="secondary" disabled={page >= data.totalPages} onClick={() => setPage(page + 1)}>Sonraki</Button>
        </div>
      )}
    </div>
  );
}
