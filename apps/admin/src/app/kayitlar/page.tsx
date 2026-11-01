'use client';
import type { AuditLogEntry } from '@kleps/api-client';
import type { Paginated } from '@kleps/shared';
import { useEffect, useState } from 'react';
import { Alert, Button, Spinner } from '@/components/ui';
import { browserApi, errorMessage } from '@/lib/browser-api';
import { t } from '@/lib/i18n';

const dt = new Intl.DateTimeFormat('tr-TR', { dateStyle: 'short', timeStyle: 'medium' });

export default function AuditPage() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<AuditLogEntry> | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    browserApi.admin.auditLogs({ page, pageSize: 50 }).then(setData, (e: unknown) => setError(errorMessage(e)));
  }, [page]);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">{t('admin.auditLog')}</h1>
      {error && <Alert>{error}</Alert>}
      {!data ? <Spinner /> : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs text-fg-muted">
              <tr><th className="p-3">Zaman</th><th className="p-3">Kişi</th><th className="p-3">İşlem</th><th className="p-3">Kayıt</th><th className="p-3">Ayrıntı</th></tr>
            </thead>
            <tbody>
              {data.items.map((l) => (
                <tr key={l.id} className="border-t border-line align-top">
                  <td className="whitespace-nowrap p-3">{dt.format(new Date(l.createdAt))}</td>
                  <td className="p-3">{l.actor ? `@${l.actor.username}` : '—'}</td>
                  <td className="p-3 font-mono text-xs">{l.action}</td>
                  <td className="p-3 font-mono text-xs">{l.entityType}:{l.entityId}</td>
                  <td className="max-w-xs truncate p-3 font-mono text-xs" title={JSON.stringify(l.metadata)}>{l.metadata ? JSON.stringify(l.metadata) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && data.totalPages > 1 && (
        <div className="flex justify-center gap-3">
          <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>{t('common.previous')}</Button>
          <Button variant="secondary" disabled={page >= data.totalPages} onClick={() => setPage(page + 1)}>{t('common.next')}</Button>
        </div>
      )}
    </div>
  );
}
