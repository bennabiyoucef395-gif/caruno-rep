// Fiche pièce : stock par entrepôt, prix par niveau, équivalences (même OEM), fournisseurs, derniers mouvements,
// et mouvements de stock manuels (correction, transfert) pour les comptes qui en ont le droit.
import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Text, XStack, YStack } from 'tamagui';
import { useTranslation } from 'react-i18next';
import { useApp, money } from '@/state/app';
import { useLoad, dateFr, explain } from '@/lib/useLoad';
import type { Movement, Product } from '@/lib/dolibarr';
import { Badge, Btn, Card, Choice, Field, H2, KV, Notice, PageHead, Screen, Table } from '@/components/ui';
import { StockBadge } from '@/components/StockBadge';
import { C } from '@/theme/colors';

export default function PieceCard() {
  const { t } = useTranslation();
  const { api, auth } = useApp();
  const params = useLocalSearchParams<{ id: string; created?: string }>();
  const id = Number(params.id);
  const da = t('common.da');
  const { data, error, loading, reload } = useLoad(async () => {
    const p = await api.productFull(id);
    const [whs, eq, sups, moves] = await Promise.all([
      api.warehouses().catch(() => []),
      api.equivalents(p.oem, p.id).catch(() => [] as Product[]),
      auth.cap?.seeCost ? api.purchasePrices(id).catch(() => []) : Promise.resolve([]),
      api.movements({ productId: id, limit: 10 }).then((r) => r.items).catch(() => [] as Movement[]),
    ]);
    return { p, whs, eq, sups, moves };
  }, [api, id]);

  const back = { label: t('pieces.title'), onPress: () => router.replace('/pieces') };
  if (!data) return <Screen><PageHead title={loading ? t('common.loading') : t('piece.notFound')} back={back} />{error ? <Notice tone="bad">{error}</Notice> : null}</Screen>;
  const { p, whs, eq, sups, moves } = data;
  const whName = (w: number) => whs.find((x) => x.id === w)?.label || '#' + w;
  const levels = [1, 2, 3].map((l) => { const n = t('pos.level' + l); return n.charAt(0).toUpperCase() + n.slice(1); });

  return (
    <Screen testID="piece-screen">
      <PageHead back={back} title={p.label}
        sub={<XStack gap={8} flexWrap="wrap" alignItems="center">
          {p.brand ? <Badge label={p.brand} tone="accent" /> : null}
          <Text color={C.muted}>{t('pieces.ref')} {p.ref}</Text>
          {p.oem ? <Text color={C.muted}>· OEM {p.oem}</Text> : null}
          {p.barcode ? <Text color={C.muted}>· EAN {p.barcode}</Text> : null}
          {p.refExt ? <Badge label={t('piece.fromCatalogue')} tone="info" /> : null}
        </XStack>}
        actions={<>
          {auth.cap?.sell ? <Btn label={t('piece.sell')} variant="primary" onPress={() => router.push(('/caisse?add=' + p.id) as never)} testID="piece-sell" /> : null}
          {auth.cap?.createProduct ? <Btn label={t('piece.edit')} variant="outline" onPress={() => router.push(('/pieces/' + p.id + '/modifier') as never)} testID="piece-edit" /> : null}
        </>} />
      {params.created ? <Notice tone="ok">{t('newPiece.created', { ref: p.ref })}</Notice> : null}

      <XStack gap={16} flexWrap="wrap" alignItems="flex-start">
        <Card flexGrow={1} flexBasis={300}>
          <XStack justifyContent="space-between" alignItems="center"><H2>{t('pieces.stock')}</H2><StockBadge p={p} /></XStack>
          {whs.map((w) => (
            <XStack key={w.id} justifyContent="space-between" alignItems="center" paddingVertical={6} borderBottomWidth={1} borderColor={C.line2}>
              <Text fontWeight="600">{w.label}</Text>
              <Text fontSize={24} fontWeight="700" testID={'piece-stock-' + w.id}>{p.byWarehouse[w.id] || 0}</Text>
            </XStack>
          ))}
          <Text fontSize={13} color={C.muted}>{t('piece.thresholds', { a: p.alert || '—', d: p.desired || '—' })}{p.location ? ' · ' + t('pieces.location') + ' ' + p.location : ''}</Text>
        </Card>

        <Card flexGrow={1} flexBasis={300}>
          <H2>{t('piece.prices')}</H2>
          {levels.map((l, i) => <KV key={l} k={(i + 1) + ' · ' + l} v={p.prices[i] ? money(p.prices[i], da) : '—'} />)}
          {p.minPrice ? <Text fontSize={13} color={C.muted}>{t('piece.minPrice', { v: money(p.minPrice, da) })}</Text> : null}
          {auth.cap?.seeCost
            ? <Notice tone="ok">{t('piece.cost', { v: p.cost ? money(p.cost, da) : '—' })}</Notice>
            : <Text fontSize={13} color={C.muted}>{t('piece.costHidden')}</Text>}
        </Card>

        {auth.cap?.stockMoves && whs.length ? <StockMove p={p} whs={whs} onDone={reload} /> : null}
      </XStack>

      <YStack gap={8}>
        <H2>{t('piece.equivalents')}{p.oem ? ' · OEM ' + p.oem : ''}</H2>
        <Table rows={eq} keyOf={(x) => x.id} onPress={(x) => router.push(('/pieces/' + x.id) as never)} minWidth={560} empty={p.oem ? t('piece.noEquivalent') : t('piece.noOem')}
          cols={[
            { key: 'b', label: t('pieces.brand'), width: 120, render: (x) => <Text fontWeight="700">{x.brand || '—'}</Text> },
            { key: 'r', label: t('pieces.ref'), flex: 1, render: (x) => x.ref },
            { key: 'l', label: t('pieces.label'), flex: 2, render: (x) => x.label },
            { key: 's', label: t('pieces.stock'), width: 80, align: 'right', render: (x) => String(x.stock) },
            { key: 'p', label: t('pieces.public'), width: 110, align: 'right', render: (x) => (x.prices[0] ? money(x.prices[0], da) : '—') },
          ]} />
      </YStack>

      {auth.cap?.seeCost ? (
        <YStack gap={8}>
          <H2>{t('piece.suppliers')}</H2>
          <Table rows={sups} keyOf={(s) => s.supplier + s.ref} minWidth={520} empty={t('piece.noSupplier')}
            cols={[
              { key: 's', label: t('piece.supplier'), flex: 2, render: (s) => <Text fontWeight="700">{s.supplier}</Text> },
              { key: 'r', label: t('piece.supplierRef'), flex: 1, render: (s) => s.ref || '—' },
              { key: 'p', label: t('piece.buyPrice'), width: 120, align: 'right', render: (s) => money(s.price, da) },
              { key: 'd', label: t('piece.delay'), width: 80, align: 'right', render: (s) => (s.delay ? s.delay + ' j' : '—') },
            ]} />
        </YStack>
      ) : null}

      <YStack gap={8}>
        <H2>{t('piece.moves')}</H2>
        <Table rows={moves} keyOf={(m) => m.id} minWidth={560} empty={t('piece.noMove')}
          cols={[
            { key: 'd', label: t('common.date'), width: 140, render: (m) => dateFr(m.date, true) },
            { key: 'l', label: t('piece.reason'), flex: 2, render: (m) => m.label },
            { key: 'q', label: t('pos.qty'), width: 70, align: 'right', render: (m) => <Text fontWeight="700" color={m.qty < 0 ? C.bad : C.ok}>{(m.qty > 0 ? '+' : '') + m.qty}</Text> },
            { key: 'w', label: t('piece.warehouse'), width: 110, render: (m) => whName(m.warehouseId) },
          ]} />
      </YStack>
    </Screen>
  );
}

// Correction (stock compté) ou transfert entre entrepôts : mouvements Dolibarr, le stock suit tout de suite.
function StockMove({ p, whs, onDone }: { p: Product; whs: { id: number; label: string }[]; onDone: () => void }) {
  const { t } = useTranslation();
  const { api } = useApp();
  const [mode, setMode] = useState<'count' | 'transfer'>('count');
  const [wh, setWh] = useState(whs[0].id);
  const [to, setTo] = useState((whs[1] || whs[0]).id);
  const [qty, setQty] = useState('');
  const [msg, setMsg] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const n = parseInt(qty.replace(/\D/g, ''), 10);
  const current = p.byWarehouse[wh] || 0;

  const run = async () => {
    if (!Number.isFinite(n)) return;
    setBusy(true); setMsg(null);
    try {
      if (mode === 'count') {
        const delta = n - current;
        if (!delta) { setMsg({ tone: 'ok', text: t('piece.countSame') }); return; }
        await api.addMovement(p.id, wh, delta, 'Correction CARUNO (compté ' + n + ')');
        setMsg({ tone: 'ok', text: t('piece.countDone', { d: (delta > 0 ? '+' : '') + delta }) });
      } else {
        if (wh === to || n <= 0) return;
        if (n > current) { setMsg({ tone: 'bad', text: t('piece.notEnough', { n: current }) }); return; }
        await api.addMovement(p.id, wh, -n, 'Transfert CARUNO');
        await api.addMovement(p.id, to, n, 'Transfert CARUNO');
        setMsg({ tone: 'ok', text: t('piece.transferDone', { n }) });
      }
      setQty(''); onDone();
    } catch (e) { setMsg({ tone: 'bad', text: explain(e) }); }
    finally { setBusy(false); }
  };

  const opts = whs.map((w) => [w.id, w.label] as [number, string]);
  return (
    <Card flexGrow={1} flexBasis={300}>
      <H2>{t('piece.stockMove')}</H2>
      <Choice value={mode} onChange={(v) => { setMode(v); setMsg(null); }} options={[['count', t('piece.count')], ['transfer', t('piece.transfer')]]} testID="move-mode" />
      <Choice label={mode === 'count' ? t('piece.warehouse') : t('piece.from')} value={wh} onChange={setWh} options={opts} testID="move-wh" />
      {mode === 'transfer' ? <Choice label={t('piece.to')} value={to} onChange={setTo} options={opts.filter(([v]) => v !== wh)} testID="move-to" /> : null}
      <Field label={mode === 'count' ? t('piece.counted', { n: current }) : t('pos.qty')} value={qty} onChangeText={setQty} keyboardType="number-pad" testID="move-qty" onSubmitEditing={run} />
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      <Btn label={busy ? t('common.loading') : mode === 'count' ? t('piece.applyCount') : t('piece.transfer')} variant="dark" onPress={run} disabled={busy || !Number.isFinite(n) || (mode === 'transfer' && wh === to)} testID="move-go" />
    </Card>
  );
}
