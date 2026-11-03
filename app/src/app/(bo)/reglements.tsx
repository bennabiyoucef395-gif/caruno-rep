// Règlements : soldes des comptes Dolibarr (Caisse, Banque), opérations de chaque compte, factures impayées.
import { useState } from 'react';
import { router } from 'expo-router';
import { Text, XStack } from 'tamagui';
import { useTranslation } from 'react-i18next';
import { useApp, money } from '@/state/app';
import { useLoad, dateFr } from '@/lib/useLoad';
import { Kpi, Notice, PageHead, Screen, Table, Tabs } from '@/components/ui';
import { C } from '@/theme/colors';

export default function Reglements() {
  const { t } = useTranslation();
  const { api } = useApp();
  const da = t('common.da');
  const accounts = useLoad(() => api.bankAccounts(), [api]);
  const [tab, setTab] = useState<string>('unpaid');
  const lines = useLoad(async () => (tab === 'unpaid' ? null : api.bankLines(Number(tab), 60)), [api, tab]);
  const unpaid = useLoad(async () => {
    const r = await api.listDocs('invoice', { unpaid: true, limit: 100 });
    return { items: r.items, names: await api.names(r.items.map((d) => d.socid)).catch(() => ({} as Record<number, string>)) };
  }, [api]);
  const due = (unpaid.data?.items || []).reduce((s, d) => s + d.remain, 0);

  return (
    <Screen testID="reglements-screen">
      <PageHead title={t('reg.title')} sub={t('reg.sub')} />
      {accounts.error ? <Notice tone="bad">{accounts.error}</Notice> : null}
      <XStack gap={16} flexWrap="wrap">
        {(accounts.data || []).map((a) => <Kpi key={a.id} label={a.label} value={money(a.balance, da)} sub={t('reg.balance')} />)}
        <Kpi label={t('reg.unpaidTotal')} value={money(due, da)} sub={t('reg.unpaidCount', { n: unpaid.data?.items.length ?? 0 })} />
      </XStack>
      <Tabs value={tab} onChange={setTab} tabs={[['unpaid', t('reg.unpaid')], ...(accounts.data || []).map((a) => [String(a.id), a.label] as [string, string])]} />
      {tab === 'unpaid' ? (
        <Table rows={unpaid.data?.items || []} keyOf={(d) => d.id} onPress={(d) => router.push(('/ventes/invoice/' + d.id) as never)} minWidth={680} empty={unpaid.loading ? t('common.loading') : t('clients.nothingDue')}
          cols={[
            { key: 'r', label: t('doc.ref'), width: 150, render: (d) => <Text fontWeight="600">{d.ref}</Text> },
            { key: 'c', label: t('clients.client'), flex: 2, render: (d) => unpaid.data?.names[d.socid] || '#' + d.socid },
            { key: 'd', label: t('common.date'), width: 110, render: (d) => dateFr(d.date) },
            { key: 'e', label: t('reg.dueDate'), width: 110, render: (d) => <Text color={d.due && d.due < Date.now() / 1000 ? C.bad : C.ink}>{dateFr(d.due)}</Text> },
            { key: 'm', label: t('doc.remain'), width: 130, align: 'right', render: (d) => <Text fontWeight="700">{money(d.remain, da)}</Text> },
          ]} />
      ) : (
        <>
          {lines.error ? <Notice tone="bad">{lines.error}</Notice> : null}
          <Table rows={lines.data || []} keyOf={(l) => l.id} minWidth={560} empty={lines.loading ? t('common.loading') : t('reg.noLine')}
            cols={[
              { key: 'd', label: t('common.date'), width: 110, render: (l) => dateFr(l.date) },
              { key: 'l', label: t('reg.operation'), flex: 3, render: (l) => l.label },
              { key: 't', label: t('reg.type'), width: 80, render: (l) => l.type },
              { key: 'a', label: t('session.amount'), width: 130, align: 'right', render: (l) => <Text fontWeight="700" color={l.amount < 0 ? C.bad : C.ink}>{money(l.amount, da)}</Text> },
            ]} />
        </>
      )}
    </Screen>
  );
}
