// Ventes : devis, commandes, livraisons, factures et avoirs du magasin (documents Dolibarr), selon les droits.
import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Text, XStack } from 'tamagui';
import { useTranslation } from 'react-i18next';
import { useApp, money } from '@/state/app';
import type { DocKind } from '@/lib/dolibarr';
import { useLoad, dateFr } from '@/lib/useLoad';
import { Btn, Field, Notice, PageHead, Pager, Screen, Table, Tabs } from '@/components/ui';
import { DocBadge } from '@/components/StockBadge';
import { C } from '@/theme/colors';

const LIMIT = 40;

export default function Ventes() {
  const { t } = useTranslation();
  const { api, auth } = useApp();
  const start = useLocalSearchParams<{ tab?: DocKind }>().tab;
  const tabs = ([
    auth.cap?.proposals ? ['proposal', t('ventes.proposals')] : null,
    auth.cap?.orders ? ['order', t('ventes.orders')] : null,
    auth.cap?.orders ? ['shipment', t('ventes.shipments')] : null,
    auth.cap?.invoices ? ['invoice', t('ventes.invoices')] : null,
    auth.cap?.invoices ? ['credit', t('ventes.credits')] : null,
  ].filter(Boolean)) as [DocKind, string][];
  const [tab, setTab] = useState<DocKind>(start && tabs.some(([k]) => k === start) ? start : tabs.find(([k]) => k === 'invoice')?.[0] || tabs[0]?.[0] || 'invoice');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [unpaid, setUnpaid] = useState(false);
  const [page, setPage] = useState(0);
  useEffect(() => { const h = setTimeout(() => { setQuery(q.trim()); setPage(0); }, 300); return () => clearTimeout(h); }, [q]);
  const da = t('common.da');

  const { data, error, loading } = useLoad(async () => {
    const r = await api.listDocs(tab, { q: query, page, limit: LIMIT, unpaid: tab === 'invoice' && unpaid });
    const names = await api.names(r.items.map((d) => d.socid)).catch(() => ({} as Record<number, string>));
    return { ...r, names };
  }, [api, tab, query, page, unpaid]);

  const isInv = tab === 'invoice' || tab === 'credit';
  return (
    <Screen testID="ventes-screen">
      <PageHead title={t('ventes.title')} sub={t('ventes.sub')}
        actions={auth.cap?.sell ? <Btn label={'+ ' + t('ventes.counterSale')} variant="primary" onPress={() => router.push('/caisse')} /> : null} />
      {tabs.length ? <Tabs value={tab} onChange={(k) => { setTab(k); setPage(0); }} tabs={tabs} /> : <Notice tone="warn">{t('ventes.noRight')}</Notice>}
      <XStack gap={12} flexWrap="wrap" alignItems="center">
        <XStack flexGrow={1} minWidth={240}><Field placeholder={t('ventes.search')} value={q} onChangeText={setQ} testID="ventes-q" /></XStack>
        {tab === 'invoice' ? <Btn label={unpaid ? '✓ ' + t('ventes.unpaidOnly') : t('ventes.unpaidOnly')} variant={unpaid ? 'dark' : 'plain'} onPress={() => { setUnpaid(!unpaid); setPage(0); }} testID="ventes-unpaid" /> : null}
      </XStack>
      {error ? <Notice tone="bad">{error}</Notice> : null}
      <Table rows={data?.items || []} keyOf={(d) => d.id} onPress={(d) => router.push(('/ventes/' + tab + '/' + d.id) as never)} minWidth={760} empty={loading ? t('common.loading') : t('ventes.none')} testID="ventes-table"
        cols={[
          { key: 'r', label: t('doc.ref'), width: 150, render: (d) => <Text fontWeight="600">{d.ref}</Text> },
          { key: 'c', label: t('clients.client'), flex: 2, render: (d) => data?.names[d.socid] || '#' + d.socid },
          { key: 'd', label: t('common.date'), width: 110, render: (d) => dateFr(d.date) },
          { key: 's', label: t('doc.status'), width: 130, render: (d) => <DocBadge kind={tab} status={d.status} paid={d.paid} remain={d.remain} total={d.total} /> },
          { key: 't', label: t('common.total'), width: 120, align: 'right', render: (d) => <Text fontWeight="700">{(tab === 'credit' ? '−' : '') + money(Math.abs(d.total), da)}</Text> },
          ...(isInv && tab === 'invoice' ? [{ key: 'm', label: t('doc.remain'), width: 120, align: 'right' as const, render: (d: { remain: number }) => <Text color={d.remain ? C.bad : C.muted}>{money(d.remain, da)}</Text> }] : []),
        ]} />
      {data ? <XStack justifyContent="center"><Pager page={page} total={data.total} limit={LIMIT} onPage={setPage} label={(p, n) => t('common.page', { p, n })} /></XStack> : null}
    </Screen>
  );
}
