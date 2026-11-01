import type { ListingCardDto, Paginated } from '@kleps/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '../i18n';

/** Loads paginated listings with refresh + infinite scroll. `deps` re-run the first page. */
export function usePaginated(fetchPage: (page: number) => Promise<Paginated<ListingCardDto>>, deps: unknown[]) {
  const [items, setItems] = useState<ListingCardDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadingMore = useRef(false);
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;

  const reload = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await fetchRef.current(1);
      setItems(res.items);
      setTotal(res.total);
      setPage(1);
      setTotalPages(res.totalPages);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => void reload(), deps);

  const loadMore = useCallback(async () => {
    if (loadingMore.current || page >= totalPages) return;
    loadingMore.current = true;
    try {
      const res = await fetchRef.current(page + 1);
      setItems((prev) => [...prev, ...res.items.filter((i) => !prev.some((p) => p.id === i.id))]);
      setPage(res.page);
      setTotalPages(res.totalPages);
    } catch {
      // Keep existing items; the user can pull to refresh.
    } finally {
      loadingMore.current = false;
    }
  }, [page, totalPages]);

  return { items, total, loading, refreshing, error, reload, loadMore };
}
