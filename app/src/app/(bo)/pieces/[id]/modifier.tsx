// Modification d'une pièce existante.
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useApp } from '@/state/app';
import { useLoad } from '@/lib/useLoad';
import { Notice, PageHead, Screen } from '@/components/ui';
import { PieceForm } from '@/components/PieceForm';

export default function ModifierPiece() {
  const { t } = useTranslation();
  const { api } = useApp();
  const id = Number(useLocalSearchParams<{ id: string }>().id);
  const { data, error } = useLoad(() => api.productFull(id), [api, id]);
  return (
    <Screen testID="edit-piece-screen">
      <PageHead title={t('piece.editTitle')} sub={data ? data.brand + ' ' + data.ref : ''} back={{ label: t('piece.backToCard'), onPress: () => router.replace(('/pieces/' + id) as never) }} />
      {error ? <Notice tone="bad">{error}</Notice> : null}
      {data ? <PieceForm product={data} /> : null}
    </Screen>
  );
}
