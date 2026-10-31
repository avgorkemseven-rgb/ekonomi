import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { api } from '@/api';
import { SearchView } from '@/components/SearchView';

export default function CategoryScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [title, setTitle] = useState('');
  useEffect(() => {
    api.categories.detail(slug).then((c) => setTitle(c.name), () => undefined);
  }, [slug]);
  return (
    <>
      <Stack.Screen options={{ title }} />
      <SearchView category={slug} />
    </>
  );
}
