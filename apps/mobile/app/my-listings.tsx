import { router } from 'expo-router';
import { api } from '@/api';
import { ListingList } from '@/components/ListingList';
import { Button, Empty, ErrorView, Loading } from '@/components/ui';
import { usePaginated } from '@/components/usePaginated';
import { t } from '@/i18n';
import { useSession } from '@/session';

export default function MyListingsScreen() {
  const { user } = useSession();
  const list = usePaginated((page) => api.me.listings({ page, pageSize: 20 }), [user?.id]);
  if (!user) return <ErrorView message={t('auth.loginRequired')} onRetry={() => router.push('/login')} />;
  if (list.loading) return <Loading />;
  if (list.error) return <ErrorView message={list.error} onRetry={() => void list.reload()} />;
  return (
    <ListingList
      showStatus
      items={list.items}
      empty={<Empty title={t('myListings.empty')}><Button title={t('nav.sell')} onPress={() => router.push('/sell')} /></Empty>}
      onEndReached={() => void list.loadMore()}
      refreshing={list.refreshing}
      onRefresh={() => void list.reload(true)}
    />
  );
}
