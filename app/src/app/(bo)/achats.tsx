// Achats : commandes fournisseurs et fournisseurs du magasin (lecture ; la réception se fait dans Dolibarr pour l'instant).
import { useState } from 'react';
import { router } from 'expo-router';
import { Text, XStack } from 'tamagui';
import { useTranslation } from 'react-i18next';
import { useApp, money } from '@/state/app';
import { useLoad, dateFr } from '@/lib/useLoad';
import { Notice, PageHead, Pager, Screen, Table, Tabs } from '@/components/ui';
import { DocBadge } from '@/components/StockBadge';

export default function Achats() {
  const { t } = useTranslation();
  const { api, auth } = useApp();
  const [tab, setTab] = useState<'orders' | 'suppliers'>('orders');
  const [page, setPage] = useState(0);
  const da = t('common.da');
  const { data, error, loading } = useLoad(async () => {
    if (tab === 'orders') {
      const r = await api.listDocs('supplierOrder', { page, limit: 40 });
      return { orders: r, names: await api.names(r.items.map((d) => d.socid)).catch(() => ({} as Record<number, string>)), suppliers: null };
    }
    return { orders: null, names: {} as Record<number, string>, suppliers: await api.listThirdparties({ mode: 4, page, limit: 40 }) };
  }, [api, tab, page]);

  return (
    <Screen testID="achats-screen">
      <PageHead title={t('achats.title')} sub={t('achats.sub')} />
      <Tabs value={tab} onChange={(k) => { setTab(k); setPage(0); }} tabs={[['orders', t('achats.orders')], ['suppliers', t('achats.suppliers')]]} />
      {error ? <Notice tone="bad">{error}</Notice> : null}
      {tab === 'orders' ? <>
        <Table rows={data?.orders?.items || []} keyOf={(d) => d.id} onPress={(d) => router.push(('/ventes/supplierOrder/' + d.id) as never)} minWidth={700} empty={loading ? t('common.loading') : t('achats.noOrder')}
          cols={[
            { key: 'r', label: t('doc.ref'), width: 150, render: (d) => <Text fontWeight="600">{d.ref}</Text> },
            { key: 's', label: t('piece.supplier'), flex: 2, render: (d) => data?.names[d.socid] || '#' + d.socid },
            { key: 'd', label: t('common.date'), width: 110, render: (d) => dateFr(d.date) },
            { key: 'st', label: t('doc.status'), width: 150, render: (d) => <DocBadge kind="supplierOrder" status={d.status} /> },
            ...(auth.cap?.seeCost ? [{ key: 't', label: t('common.total'), width: 120, align: 'right' as const, render: (d: { total: number }) => money(d.total, da) }] : []),
          ]} />
        {data?.orders ? <XStack justifyContent="center"><Pager page={page} total={data.orders.total} limit={40} onPage={setPage} label={(p, n) => t('common.page', { p, n })} /></XStack> : null}
      </> : (
        <Table rows={data?.suppliers?.items || []} keyOf={(c) => c.id} minWidth={620} empty={loading ? t('common.loading') : t('achats.noSupplier')}
          cols={[
            { key: 'n', label: t('piece.supplier'), flex: 2, render: (c) => <Text fontWeight="700">{c.name}</Text> },
            { key: 't', label: t('clients.town'), flex: 1, render: (c) => c.town || '—' },
            { key: 'p', label: t('clients.phone'), flex: 1, render: (c) => c.phone || '—' },
            { key: 'e', label: t('clients.email'), flex: 1, render: (c) => c.email || '—' },
          ]} />
      )}
    </Screen>
  );
}
