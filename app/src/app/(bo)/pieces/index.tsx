// Liste des pièces du magasin, directement depuis Dolibarr : toutes les pièces, les plus récentes en tête
// (une pièce créée apparaît tout de suite), recherche (référence, OEM, marque, désignation, code-barres) et filtre de stock.
import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Text, XStack, YStack } from 'tamagui';
import { useTranslation } from 'react-i18next';
import { useApp, money } from '@/state/app';
import type { Product } from '@/lib/dolibarr';
import { useLoad } from '@/lib/useLoad';
import { Btn, Choice, Field, Notice, PageHead, Pager, Screen, Table, type Col } from '@/components/ui';
import { StockBadge } from '@/components/StockBadge';
import { C } from '@/theme/colors';

const LIMIT = 50;

export default function Pieces() {
  const { t } = useTranslation();
  const { api, auth } = useApp();
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [stock, setStock] = useState<'' | 'in' | 'out'>('');
  const [page, setPage] = useState(0);
  const da = t('common.da');

  // Recherche lancée après une courte pause de frappe.
  useEffect(() => { const h = setTimeout(() => { setQuery(q.trim()); setPage(0); }, 300); return () => clearTimeout(h); }, [q]);
  const { data, error, loading } = useLoad(() => api.listProducts({ q: query, stock, page, limit: LIMIT }), [api, query, stock, page]);

  const cols: Col<Product>[] = [
    { key: 'p', label: t('pieces.piece'), flex: 3, render: (p) => <YStack><Text fontWeight="600" numberOfLines={2}>{p.label}</Text>{p.brand ? <Text fontSize={12} color={C.muted}>{p.brand}</Text> : null}</YStack> },
    { key: 'r', label: t('pieces.refOem'), flex: 2, render: (p) => <YStack><Text fontSize={13}>{p.ref}</Text>{p.oem ? <Text fontSize={12} color={C.muted}>{p.oem}</Text> : null}</YStack> },
    { key: 'l', label: t('pieces.location'), width: 90, render: (p) => p.location || '—' },
    { key: 's', label: t('pieces.stock'), width: 80, align: 'right', render: (p) => <Text fontWeight="700" color={p.stock > 0 ? C.ink : C.bad}>{p.stock}</Text> },
    { key: 'e', label: t('pieces.state'), width: 120, render: (p) => <StockBadge p={p} /> },
    { key: 'pr', label: t('pieces.public'), width: 110, align: 'right', render: (p) => (p.prices[0] ? money(p.prices[0], da) : '—') },
    ...(auth.cap?.seeCost ? [{ key: 'c', label: t('pieces.cost'), width: 100, align: 'right' as const, render: (p: Product) => <Text color={C.muted}>{p.cost ? money(p.cost, da) : '—'}</Text> }] : []),
  ];

  return (
    <Screen testID="pieces-screen">
      <PageHead title={t('pieces.title')} sub={data ? t('pieces.count', { n: data.total.toLocaleString('fr-FR') }) : t('common.loading')}
        actions={auth.cap?.createProduct ? <Btn label={'+ ' + t('pieces.new')} variant="primary" onPress={() => router.push('/pieces/nouvelle')} testID="pieces-new" /> : null} />
      <XStack gap={12} flexWrap="wrap" alignItems="flex-end">
        <YStack flexGrow={3} minWidth={260}><Field placeholder={t('pieces.search')} value={q} onChangeText={setQ} autoFocus autoCapitalize="none" testID="pieces-q" /></YStack>
        <Choice value={stock} onChange={(v) => { setStock(v); setPage(0); }} options={[['', t('pieces.allStock')], ['in', t('pieces.inStock')], ['out', t('pieces.out')]]} testID="pieces-stock" />
      </XStack>
      {error ? <Notice tone="bad">{error}</Notice> : null}
      <Table cols={cols} rows={data?.items || []} keyOf={(p) => p.id} onPress={(p) => router.push(('/pieces/' + p.id) as never)} minWidth={auth.cap?.seeCost ? 900 : 800}
        empty={loading ? t('common.loading') : t('pieces.none')} testID="pieces-table" />
      {data ? <Pager page={page} total={data.total} limit={LIMIT} onPage={setPage} label={(p, n) => t('common.page', { p, n })} /> : null}
    </Screen>
  );
}
