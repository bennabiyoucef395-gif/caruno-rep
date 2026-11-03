// Clients du magasin (tiers clients Dolibarr) : recherche nom / ville / téléphone, niveau de prix, plafond d'encours.
import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Text, XStack, YStack } from 'tamagui';
import { useTranslation } from 'react-i18next';
import { useApp, money } from '@/state/app';
import { useLoad } from '@/lib/useLoad';
import { Btn, Field, Notice, PageHead, Pager, Screen, Table } from '@/components/ui';
import { LevelBadge } from '@/components/StockBadge';
import { C } from '@/theme/colors';

const LIMIT = 50;

export default function Clients() {
  const { t } = useTranslation();
  const { api, auth } = useApp();
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  useEffect(() => { const h = setTimeout(() => { setQuery(q.trim()); setPage(0); }, 300); return () => clearTimeout(h); }, [q]);
  const { data, error, loading } = useLoad(() => api.listThirdparties({ mode: 1, q: query, page, limit: LIMIT }), [api, query, page]);
  const da = t('common.da');

  return (
    <Screen testID="clients-screen">
      <PageHead title={t('clients.title')} sub={data ? t('clients.count', { n: data.total }) : t('common.loading')}
        actions={auth.cap?.editCustomers ? <Btn label={'+ ' + t('clients.new')} variant="primary" onPress={() => router.push('/clients/nouveau')} testID="clients-new" /> : null} />
      <Field placeholder={t('clients.search')} value={q} onChangeText={setQ} autoFocus testID="clients-q" />
      {error ? <Notice tone="bad">{error}</Notice> : null}
      <Table rows={data?.items || []} keyOf={(c) => c.id} onPress={(c) => router.push(('/clients/' + c.id) as never)} minWidth={760} empty={loading ? t('common.loading') : t('clients.none')} testID="clients-table"
        cols={[
          { key: 'n', label: t('clients.client'), flex: 3, render: (c) => <Text fontWeight="600">{c.name}</Text> },
          { key: 'c', label: t('clients.category'), width: 200, render: (c) => <LevelBadge c={c} /> },
          { key: 't', label: t('clients.town'), flex: 1, render: (c) => c.town || '—' },
          { key: 'p', label: t('clients.phone'), flex: 1, render: (c) => c.phone || '—' },
          { key: 'l', label: t('clients.limit'), width: 120, align: 'right', render: (c) => <Text color={C.muted}>{c.outstandingLimit ? money(c.outstandingLimit, da) : '—'}</Text> },
        ]} />
      {data ? <XStack justifyContent="center"><Pager page={page} total={data.total} limit={LIMIT} onPage={setPage} label={(p, n) => t('common.page', { p, n })} /></XStack> : null}
      <YStack />
    </Screen>
  );
}
