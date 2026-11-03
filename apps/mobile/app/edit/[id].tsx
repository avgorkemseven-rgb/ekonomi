import { MAX_LISTING_PHOTOS, type ListingDetailDto } from '@kleps/shared';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { api } from '@/api';
import { ListingFormMobile } from '@/components/ListingFormMobile';
import { Badge, Banner, Button, ErrorView, Loading } from '@/components/ui';
import { errorMessage, t } from '@/i18n';
import { fontSizes, radii, spacing, useTheme } from '@/theme';

export default function EditListingScreen() {
  const c = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [listing, setListing] = useState<ListingDetailDto | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; tone: 'danger' | 'success' } | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(() => {
    api.listings.get(id).then(setListing, (e: unknown) => setLoadError(errorMessage(e)));
  }, [id]);
  useEffect(load, [load]);

  if (loadError) return <ErrorView message={loadError} onRetry={load} />;
  if (!listing) return <Loading />;

  async function pickPhotos() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return setMessage({ text: 'Galeri izni verilmedi.', tone: 'danger' });
    const remaining = MAX_LISTING_PHOTOS - listing!.images.length;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.85, // re-encodes to JPEG, so HEIC photos from iOS upload fine
      exif: false,
    });
    if (result.canceled) return;
    setMessage(null);
    let images = [...listing!.images];
    try {
      for (const [i, asset] of result.assets.slice(0, remaining).entries()) {
        setUploading(`${t('sell.uploading')} ${i + 1}/${result.assets.length}`);
        const form = new FormData();
        // React Native's FormData accepts { uri, name, type } file descriptors.
        form.append('file', { uri: asset.uri, name: `photo-${i}.jpg`, type: 'image/jpeg' } as unknown as Blob);
        images = [...images, await api.listings.uploadImage(listing!.id, form)];
        setListing((l) => (l ? { ...l, images } : l));
      }
    } catch (err) {
      setMessage({ text: errorMessage(err), tone: 'danger' });
    } finally {
      setUploading(null);
      // Photo changes on a live listing can send it back to review; refresh the status shown.
      if (listing!.status === 'ACTIVE') load();
    }
  }

  async function removePhoto(imageId: string) {
    try {
      await api.listings.deleteImage(listing!.id, imageId);
      setListing((l) => (l ? { ...l, images: l.images.filter((i) => i.id !== imageId) } : l));
      if (listing!.status === 'ACTIVE') load();
    } catch (err) {
      setMessage({ text: errorMessage(err), tone: 'danger' });
    }
  }

  async function publish() {
    setPublishing(true);
    setMessage(null);
    try {
      const result = await api.listings.publish(listing!.id);
      setListing(result);
      setMessage({ text: result.status === 'ACTIVE' ? t('sell.published') : t('sell.pendingReview'), tone: 'success' });
    } catch (err) {
      setMessage({ text: errorMessage(err), tone: 'danger' });
    } finally {
      setPublishing(false);
    }
  }

  const canPublish = listing.status === 'DRAFT' || listing.status === 'REJECTED';
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: c.text, fontSize: fontSizes.lg, fontWeight: '700', flex: 1 }} numberOfLines={2}>{listing.title}</Text>
          <Badge text={t(`listing.statuses.${listing.status}`)} tone={listing.status === 'ACTIVE' ? 'success' : 'warning'} />
        </View>
        {listing.moderationNote && <Banner text={listing.moderationNote} />}
        {message && <Banner text={message.text} tone={message.tone} />}

        <Text style={{ color: c.text, fontWeight: '700' }}>{t('listing.photos')} ({listing.images.length}/{MAX_LISTING_PHOTOS})</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {listing.images.map((img, i) => (
            <View key={img.id} style={{ width: 100 }}>
              <Image source={{ uri: img.thumbUrl }} style={{ width: 100, height: 100, borderRadius: radii.md, backgroundColor: c.surfaceMuted }} accessibilityLabel={`Fotoğraf ${i + 1}`} />
              <Pressable accessibilityRole="button" accessibilityLabel={`${t('common.delete')} ${i + 1}`} onPress={() => void removePhoto(img.id)}>
                <Text style={{ color: c.danger, fontSize: fontSizes.xs, textAlign: 'center', paddingVertical: 4 }}>{t('common.delete')}</Text>
              </Pressable>
            </View>
          ))}
        </View>
        <Button title={uploading ?? t('sell.addPhotos')} variant="secondary" loading={!!uploading} disabled={listing.images.length >= MAX_LISTING_PHOTOS} onPress={() => void pickPhotos()} />

        {canPublish && <Button title={publishing ? t('sell.publishing') : t('sell.publish')} onPress={() => void publish()} loading={publishing} />}
        {listing.status === 'ACTIVE' && <Button title="İlanı görüntüle" onPress={() => router.push(`/listing/${listing.id}`)} />}

        <Pressable accessibilityRole="button" onPress={() => setShowForm((s) => !s)}>
          <Text style={{ color: c.accent, fontWeight: '600' }}>{t('sell.stepDetails')} {showForm ? '▲' : '▼'}</Text>
        </Pressable>
        {showForm && <ListingFormMobile categorySlug={listing.category.slug} listing={listing} submitLabel={t('common.save')} onSaved={(l) => { setListing(l); setMessage({ text: t('sell.draftSaved'), tone: 'success' }); }} />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
