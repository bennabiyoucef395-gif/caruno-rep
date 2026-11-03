// Catalogue commun CARUNO (hors Dolibarr, partagé entre boutiques) : consultation, et création de la pièce
// dans le Dolibarr du magasin à partir d'une fiche.
import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Text, XStack, YStack } from 'tamagui';
import { useTranslation } from 'react-i18next';
import { useApp } from '@/state/app';
import { browse, loadCatalogue, type CatalogueItem } from '@/lib/catalogue';
import { Btn, Field, Notice, PageHead, Pager, Screen, Table } from '@/components/ui';
import { C } from '@/theme/colors';

const SIZE = 50;

export default function Catalogue() {
  const { t } = useTranslation();
  const { device, auth } = useApp();
  const [state, setState] = useState<'loading' | 'ok' | 'off'>('loading');
  const [count, setCount] = useState(0);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const [res, setRes] = useState<{ items: CatalogueItem[]; total: number }>({ items: [], total: 0 });

  useEffect(() => { loadCatalogue(device.catalogueUrl).then((all) => { setCount(all.length); setState('ok'); }).catch(() => setState('off')); }, [device.catalogueUrl]);
  useEffect(() => { if (state === 'ok') setRes(browse(q, page, SIZE)); }, [q, page, state]);

  return (
    <Screen testID="catalogue-screen">
      <PageHead title={t('catalogue.title')} sub={state === 'ok' ? t('catalogue.sub', { n: count.toLocaleString('fr-FR') }) : t('common.loading')} />
      {state === 'off' ? <Notice tone="warn">{t('newPiece.catalogueOff')}</Notice> : null}
      <Field placeholder={t('catalogue.search')} value={q} onChangeText={(v) => { setQ(v); setPage(0); }} autoFocus autoCapitalize="none" testID="catalogue-q" />
      <Notice tone="info">{t('catalogue.hint')}</Notice>
      <Table rows={res.items} keyOf={(it) => it.i} minWidth={880} empty={state === 'loading' ? t('common.loading') : t('catalogue.none')} testID="catalogue-table"
        cols={[
          { key: 'p', label: t('pieces.piece'), flex: 3, render: (it) => <YStack><Text fontWeight="600" numberOfLines={2}>{it.l || it.d}</Text><Text fontSize={12} color={C.muted}>{it.b}</Text></YStack> },
          { key: 'r', label: t('pieces.refOem'), flex: 2, render: (it) => <YStack><Text fontSize={13}>{it.r}</Text>{it.o ? <Text fontSize={12} color={C.muted}>{it.o}</Text> : null}</YStack> },
          { key: 'v', label: t('catalogue.vehicles'), flex: 3, render: (it) => <Text fontSize={13} numberOfLines={2}>{it.v || '—'}</Text> },
          { key: 'a', label: '', width: 170, align: 'right', render: (it) => auth.cap?.createProduct ? <Btn label={t('catalogue.create')} variant="outline" onPress={() => router.push(('/pieces/nouvelle?cat=' + encodeURIComponent(it.i)) as never)} testID={'cat-create-' + it.r} /> : null },
        ]} />
      <XStack justifyContent="center"><Pager page={page} total={res.total} limit={SIZE} onPage={setPage} label={(p, n) => t('common.page', { p, n })} /></XStack>
    </Screen>
  );
}
