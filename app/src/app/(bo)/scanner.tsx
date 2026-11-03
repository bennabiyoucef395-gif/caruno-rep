// Scanner : douchette USB (ou saisie) → la pièce, son stock par entrepôt, accès à la fiche ou à la vente.
// La lecture par la caméra du téléphone viendra avec l'application mobile.
import { useRef, useState } from 'react';
import { router } from 'expo-router';
import { Text, XStack, YStack } from 'tamagui';
import { useTranslation } from 'react-i18next';
import { useApp, money } from '@/state/app';
import type { Product } from '@/lib/dolibarr';
import { explain } from '@/lib/useLoad';
import { Btn, Card, Field, Notice, PageHead, Screen, type InputRef } from '@/components/ui';
import { StockBadge } from '@/components/StockBadge';
import { C } from '@/theme/colors';

export default function Scanner() {
  const { t } = useTranslation();
  const { api, auth } = useApp();
  const [code, setCode] = useState('');
  const [found, setFound] = useState<{ p: Product; whs: { id: number; label: string }[] } | null>(null);
  const [msg, setMsg] = useState('');
  const ref = useRef<InputRef>(null);

  const look = async () => {
    const c = code.trim();
    if (!c) return;
    setMsg(''); setFound(null);
    try {
      const hits = await api.searchProducts(c, 5);
      const hit = hits.find((p) => p.barcode === c) || hits.find((p) => p.ref.toUpperCase() === c.toUpperCase()) || hits[0];
      if (!hit) { setMsg(t('scanner.unknown', { c })); return; }
      const [p, whs] = await Promise.all([api.productFull(hit.id), api.warehouses()]);
      setFound({ p, whs });
    } catch (e) { setMsg(explain(e)); }
    finally { setCode(''); ref.current?.focus(); }
  };

  return (
    <Screen testID="scanner-screen">
      <PageHead title={t('scanner.title')} sub={t('scanner.sub')} />
      <YStack maxWidth={560} width="100%" gap={14}>
        <Field ref={ref} placeholder={t('scanner.placeholder')} value={code} onChangeText={setCode} onSubmitEditing={look} autoFocus big autoCapitalize="none" testID="scan-code" />
        {msg ? <Notice tone="bad">{msg} {auth.cap?.createProduct ? t('scanner.createHint') : ''}</Notice> : null}
        {found ? (
          <Card testID="scan-result">
            <XStack justifyContent="space-between" gap={10} alignItems="flex-start">
              <YStack flexShrink={1}><Text fontSize={18} fontWeight="700">{found.p.label}</Text><Text color={C.muted}>{[found.p.brand, found.p.ref, found.p.oem && 'OEM ' + found.p.oem].filter(Boolean).join(' · ')}</Text></YStack>
              <StockBadge p={found.p} />
            </XStack>
            <XStack gap={8} flexWrap="wrap">
              {found.whs.map((w) => <YStack key={w.id} flexGrow={1} flexBasis={140} backgroundColor={C.bg} borderRadius={10} padding={10}><Text color={C.muted}>{w.label}</Text><Text fontSize={22} fontWeight="700">{found.p.byWarehouse[w.id] || 0}</Text></YStack>)}
            </XStack>
            <Text color={C.muted}>{t('pieces.location')} {found.p.location || '—'} · {t('pieces.public')} {money(found.p.prices[0], t('common.da'))}</Text>
            <XStack gap={8}>
              <Btn label={t('scanner.card')} variant="outline" onPress={() => router.push(('/pieces/' + found.p.id) as never)} style={{ flex: 1 }} />
              {auth.cap?.sell ? <Btn label={t('piece.sell')} variant="primary" onPress={() => router.push(('/caisse?add=' + found.p.id) as never)} style={{ flex: 1 }} /> : null}
            </XStack>
          </Card>
        ) : null}
      </YStack>
    </Screen>
  );
}
