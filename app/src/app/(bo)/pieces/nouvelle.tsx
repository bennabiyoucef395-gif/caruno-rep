// Création d'une pièce dans Dolibarr ; ?cat=<id catalogue> part directement d'une fiche du catalogue commun.
import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useApp } from '@/state/app';
import { loadCatalogue, type CatalogueItem } from '@/lib/catalogue';
import { PageHead, Screen } from '@/components/ui';
import { PieceForm } from '@/components/PieceForm';

export default function NouvellePiece() {
  const { t } = useTranslation();
  const { device } = useApp();
  const cat = useLocalSearchParams<{ cat?: string }>().cat;
  const [preset, setPreset] = useState<CatalogueItem | null>(null);
  useEffect(() => { if (cat) loadCatalogue(device.catalogueUrl).then((all) => setPreset(all.find((x) => x.i === cat) || null)).catch(() => {}); }, [cat, device.catalogueUrl]);
  return (
    <Screen testID="new-piece-screen">
      <PageHead title={t('newPiece.title')} sub={t('piece.requiredHint')} back={{ label: t('pieces.title'), onPress: () => router.replace('/pieces') }} />
      <PieceForm preset={preset} />
    </Screen>
  );
}
