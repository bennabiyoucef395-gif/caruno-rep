// Fiche client : encours (factures impayées) face au plafond, documents récents, accès à la vente comptoir.
import { router, useLocalSearchParams } from 'expo-router';
import { Text, XStack, YStack } from 'tamagui';
import { useTranslation } from 'react-i18next';
import { useApp, money } from '@/state/app';
import type { Doc } from '@/lib/dolibarr';
import { useLoad, dateFr } from '@/lib/useLoad';
import { Btn, Card, H2, KV, Notice, PageHead, Screen, Table } from '@/components/ui';
import { DocBadge, LevelBadge } from '@/components/StockBadge';
import { C } from '@/theme/colors';

export default function ClientCard() {
  const { t } = useTranslation();
  const { api, auth } = useApp();
  const id = Number(useLocalSearchParams<{ id: string }>().id);
  const da = t('common.da');
  const { data, error, loading } = useLoad(async () => {
    const c = await api.customer(id);
    const [unpaid, invoices, orders] = await Promise.all([
      api.listDocs('invoice', { socid: id, unpaid: true, limit: 100 }).then((r) => r.items).catch(() => [] as Doc[]),
      api.listDocs('invoice', { socid: id, limit: 15 }).then((r) => r.items).catch(() => [] as Doc[]),
      auth.cap?.orders ? api.listDocs('order', { socid: id, limit: 10 }).then((r) => r.items).catch(() => [] as Doc[]) : Promise.resolve([] as Doc[]),
    ]);
    return { c, unpaid, invoices, orders };
  }, [api, id]);

  const back = { label: t('clients.title'), onPress: () => router.replace('/clients') };
  if (!data) return <Screen><PageHead title={loading ? t('common.loading') : t('clients.notFound')} back={back} />{error ? <Notice tone="bad">{error}</Notice> : null}</Screen>;
  const { c, unpaid, invoices, orders } = data;
  const owed = unpaid.reduce((s, d) => s + d.remain, 0);
  const now = Date.now() / 1000;
  const late = unpaid.filter((d) => d.due && d.due < now).reduce((s, d) => s + d.remain, 0);
  const pct = c.outstandingLimit ? Math.min(100, Math.round((owed / c.outstandingLimit) * 100)) : 0;
  const docCols = (kind: 'invoice' | 'order') => [
    { key: 'r', label: t('doc.ref'), flex: 1, render: (d: Doc) => <Text fontWeight="600">{d.ref}</Text> },
    { key: 'd', label: t('common.date'), width: 110, render: (d: Doc) => dateFr(d.date) },
    { key: 's', label: t('doc.status'), width: 130, render: (d: Doc) => <DocBadge kind={kind} status={d.status} paid={d.paid} remain={d.remain} total={d.total} /> },
    { key: 't', label: t('common.total'), width: 120, align: 'right' as const, render: (d: Doc) => money(d.total, da) },
    ...(kind === 'invoice' ? [{ key: 'm', label: t('doc.remain'), width: 120, align: 'right' as const, render: (d: Doc) => <Text fontWeight="700" color={d.remain ? C.bad : C.muted}>{money(d.remain, da)}</Text> }] : []),
  ];

  return (
    <Screen testID="client-screen">
      <PageHead back={back} title={c.name}
        sub={<XStack gap={8} flexWrap="wrap" alignItems="center"><LevelBadge c={c} /><Text color={C.muted}>{[c.town, c.phone, c.email, c.discount ? t('clients.discountShort', { n: c.discount }) : ''].filter(Boolean).join(' · ')}</Text></XStack>}
        actions={<>
          {auth.cap?.sell ? <Btn label={t('clients.sell')} variant="primary" onPress={() => router.push(('/caisse?client=' + c.id) as never)} testID="client-sell" /> : null}
          {auth.cap?.editCustomers ? <Btn label={t('piece.edit')} variant="outline" onPress={() => router.push(('/clients/nouveau?id=' + c.id) as never)} testID="client-edit" /> : null}
        </>} />

      <XStack gap={16} flexWrap="wrap">
        <Card flexGrow={1} flexBasis={320}>
          <H2>{t('clients.outstanding')}</H2>
          <XStack alignItems="baseline" gap={10} flexWrap="wrap">
            <Text fontSize={30} fontWeight="700" testID="client-owed">{money(owed, da)}</Text>
            <Text color={C.muted}>{c.outstandingLimit ? t('clients.ofLimit', { v: money(c.outstandingLimit, da) }) : t('clients.noCredit')}</Text>
          </XStack>
          {c.outstandingLimit ? <YStack height={10} backgroundColor={C.line2} borderRadius={5} overflow="hidden"><YStack height={10} width={(pct + '%') as never} backgroundColor={pct > 80 ? C.warn : C.ok} /></YStack> : null}
          <KV k={t('clients.late')} v={<Text fontWeight="700" color={late ? C.bad : C.ink}>{money(late, da)}</Text>} />
          <KV k={t('clients.openInvoices')} v={String(unpaid.length)} />
        </Card>
        <Card flexGrow={1} flexBasis={320}>
          <H2>{t('clients.identity')}</H2>
          <KV k={t('clients.address')} v={c.address || '—'} />
          <KV k="RC" v={c.rc || '—'} />
          <KV k="NIF" v={c.nif || '—'} />
          <KV k={t('clients.ai')} v={c.ai || '—'} />
          <KV k="NIS" v={c.nis || '—'} />
        </Card>
      </XStack>

      <YStack gap={8}>
        <H2>{t('clients.unpaid')}</H2>
        <Table rows={unpaid} keyOf={(d) => d.id} onPress={(d) => router.push(('/ventes/invoice/' + d.id) as never)} cols={docCols('invoice')} minWidth={620} empty={t('clients.nothingDue')} />
      </YStack>
      <YStack gap={8}>
        <H2>{t('clients.lastInvoices')}</H2>
        <Table rows={invoices} keyOf={(d) => d.id} onPress={(d) => router.push(('/ventes/invoice/' + d.id) as never)} cols={docCols('invoice')} minWidth={620} empty={t('ventes.none')} />
      </YStack>
      {auth.cap?.orders ? (
        <YStack gap={8}>
          <H2>{t('ventes.orders')}</H2>
          <Table rows={orders} keyOf={(d) => d.id} onPress={(d) => router.push(('/ventes/order/' + d.id) as never)} cols={docCols('order')} minWidth={560} empty={t('ventes.none')} />
        </YStack>
      ) : null}
    </Screen>
  );
}
