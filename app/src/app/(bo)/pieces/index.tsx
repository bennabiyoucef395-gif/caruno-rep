// Liste des pièces du magasin : recherche directe dans Dolibarr (référence, OEM, marque, désignation, code-barres).
import { useEffect, useState } from 'react';
import { FlatList } from 'react-native';
import { router } from 'expo-router';
import { Text, XStack, YStack } from 'tamagui';
import { useTranslation } from 'react-i18next';
import { useApp, money } from '@/state/app';
import type { Product } from '@/lib/dolibarr';
import { Btn, Field, H1, Notice } from '@/components/ui';
import { C } from '@/theme/colors';

export default function Pieces() {
  const { t } = useTranslation();
  const { api, auth } = useApp();
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Product[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (q.trim().length < 2) { setRows([]); return; }
    let live = true;
    const h = setTimeout(async () => {
      setBusy(true); setErr('');
      try { const r = await api.searchProducts(q, 60); if (live) setRows(r); }
      catch (e) { if (live) setErr((e as Error).message); }
      finally { if (live) setBusy(false); }
    }, 300);
    return () => { live = false; clearTimeout(h); };
  }, [q, api]);

  return (
    <YStack flex={1} padding={22} gap={14}>
      <XStack justifyContent="space-between" alignItems="flex-end" flexWrap="wrap" gap={10}>
        <YStack><H1>{t('pieces.title')}</H1><Text color={C.muted}>{busy ? t('common.loading') : t('pieces.count', { n: rows.length })}</Text></YStack>
        {auth.cap?.createProduct ? <Btn label={'+ ' + t('pieces.new')} variant="primary" onPress={() => router.push('/pieces/nouvelle')} testID="pieces-new" /> : null}
      </XStack>
      <Field placeholder={t('pieces.search')} value={q} onChangeText={setQ} autoFocus autoCapitalize="none" testID="pieces-q" />
      {err ? <Notice tone="bad">{err}</Notice> : null}
      <FlatList
        data={rows}
        keyExtractor={(p) => String(p.id)}
        style={{ backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.line }}
        ListEmptyComponent={<Text padding={24} color={C.muted} textAlign="center">{t('pieces.none')}</Text>}
        renderItem={({ item: p }) => (
          <XStack paddingHorizontal={14} paddingVertical={10} borderBottomWidth={1} borderColor={C.line2} gap={12} alignItems="center">
            <YStack flex={1} minWidth={0}>
              <Text fontWeight="600" numberOfLines={1}>{p.label}</Text>
              <Text fontSize={12} color={C.muted} numberOfLines={1}>{[p.brand, p.ref, p.oem && 'OEM ' + p.oem].filter(Boolean).join(' · ')}</Text>
            </YStack>
            <Text width={90} textAlign="right" color={p.stock > 0 ? C.ok : C.bad} fontWeight="700">{p.stock}</Text>
            <Text width={110} textAlign="right" fontWeight="700">{money(p.prices[0], t('common.da'))}</Text>
            {auth.cap?.seeCost ? <Text width={100} textAlign="right" color={C.muted}>{money(p.cost, t('common.da'))}</Text> : null}
          </XStack>
        )}
      />
    </YStack>
  );
}
