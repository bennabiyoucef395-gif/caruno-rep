// Stock : pièces sous le seuil d'alerte, et journal des mouvements (ventes, réceptions, corrections, transferts).
// Corrections et transferts se font depuis la fiche de la pièce.
import { useState } from 'react';
import { router } from 'expo-router';
import { Text, YStack } from 'tamagui';
import { useTranslation } from 'react-i18next';
import { useApp } from '@/state/app';
import { useLoad, dateFr } from '@/lib/useLoad';
import { Btn, Notice, PageHead, Pager, Screen, Table, Tabs } from '@/components/ui';
import { C } from '@/theme/colors';

export default function Stock() {
  const { t } = useTranslation();
  const { api } = useApp();
  const [tab, setTab] = useState<'alerts' | 'moves'>('alerts');
  const [page, setPage] = useState(0);
  const alerts = useLoad(() => api.stockAlerts(), [api]);
  const moves = useLoad(async () => {
    if (tab !== 'moves') return null;
    const [r, whs] = await Promise.all([api.movements({ page, limit: 40 }), api.warehouses()]);
    const prods = await api.productsByIds(r.items.map((m) => m.productId));
    return { ...r, prods, whs };
  }, [api, tab, page]);
  const n = alerts.data?.length ?? 0;

  return (
    <Screen testID="stock-screen">
      <PageHead title={t('stock.title')} sub={t('stock.sub')} actions={<Btn label={t('stock.correct')} onPress={() => router.push('/pieces')} />} />
      <Tabs value={tab} onChange={setTab} tabs={[['alerts', t('stock.alerts', { n })], ['moves', t('stock.moves')]]} />
      {tab === 'alerts' ? (
        <YStack gap={12}>
          {alerts.error ? <Notice tone="bad">{alerts.error}</Notice> : null}
          {!alerts.loading && !n ? <Notice tone="ok">{t('stock.noAlert')}</Notice> : null}
          <Table rows={alerts.data || []} keyOf={(p) => p.id} onPress={(p) => router.push(('/pieces/' + p.id) as never)} minWidth={720} empty={alerts.loading ? t('common.loading') : t('stock.noAlertShort')}
            cols={[
              { key: 'p', label: t('pieces.piece'), flex: 3, render: (p) => <YStack><Text fontWeight="600">{p.label}</Text><Text fontSize={12} color={C.muted}>{p.brand}</Text></YStack> },
              { key: 'r', label: t('pieces.ref'), flex: 1, render: (p) => p.ref },
              { key: 's', label: t('pieces.stock'), width: 80, align: 'right', render: (p) => <Text fontWeight="700" color={p.stock > 0 ? C.warn : C.bad}>{p.stock}</Text> },
              { key: 'a', label: t('piece.alert'), width: 80, align: 'right', render: (p) => String(p.alert) },
              { key: 'o', label: t('stock.toOrder'), width: 100, align: 'right', render: (p) => <Text fontWeight="700">{Math.max((p.desired || p.alert) - p.stock, 0)}</Text> },
            ]} />
        </YStack>
      ) : (
        <YStack gap={12}>
          {moves.error ? <Notice tone="bad">{moves.error}</Notice> : null}
          <Table rows={moves.data?.items || []} keyOf={(m) => m.id} minWidth={760} empty={moves.loading ? t('common.loading') : t('piece.noMove')}
            onPress={(m) => router.push(('/pieces/' + m.productId) as never)}
            cols={[
              { key: 'd', label: t('common.date'), width: 140, render: (m) => dateFr(m.date, true) },
              { key: 'p', label: t('pieces.piece'), flex: 2, render: (m) => { const p = moves.data?.prods[m.productId]; return <YStack><Text fontWeight="600" numberOfLines={1}>{p ? p.label : '#' + m.productId}</Text><Text fontSize={12} color={C.muted}>{p?.ref}</Text></YStack>; } },
              { key: 'l', label: t('piece.reason'), flex: 2, render: (m) => m.label },
              { key: 'q', label: t('pos.qty'), width: 70, align: 'right', render: (m) => <Text fontWeight="700" color={m.qty < 0 ? C.bad : C.ok}>{(m.qty > 0 ? '+' : '') + m.qty}</Text> },
              { key: 'w', label: t('piece.warehouse'), width: 110, render: (m) => moves.data?.whs.find((w) => w.id === m.warehouseId)?.label || '—' },
            ]} />
          {moves.data ? <Pager page={page} total={moves.data.total} limit={40} onPage={setPage} label={(p, k) => t('common.page', { p, n: k })} /> : null}
        </YStack>
      )}
    </Screen>
  );
}
