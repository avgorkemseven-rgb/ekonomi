import type { ListingCardDto } from '@kleps/shared';
import type { ReactElement } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { spacing, useTheme } from '../theme';
import { ListingCard } from './ListingCard';

/** Two-column, paginated, pull-to-refresh listing grid. */
export function ListingList({ items, header, empty, onEndReached, refreshing, onRefresh, showStatus }: { items: ListingCardDto[]; header?: ReactElement; empty?: ReactElement; onEndReached?: () => void; refreshing?: boolean; onRefresh?: () => void; showStatus?: boolean }) {
  const c = useTheme();
  return (
    <FlatList
      style={{ backgroundColor: c.background }}
      data={items}
      keyExtractor={(l) => l.id}
      numColumns={2}
      columnWrapperStyle={{ gap: spacing.md }}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      renderItem={({ item }) => (
        <View style={{ flex: 1, maxWidth: '50%' }}>
          <ListingCard listing={item} showStatus={showStatus} />
        </View>
      )}
      onEndReachedThreshold={0.4}
      onEndReached={onEndReached}
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={c.accent} /> : undefined}
    />
  );
}
