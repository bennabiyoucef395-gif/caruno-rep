// Document de vente ou d'achat : lignes, total, paiements, et encaissement du reste dû d'une facture.
import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Text, XStack, YStack } from 'tamagui';
import { useTranslation } from 'react-i18next';
import { useApp, money } from '@/state/app';
import type { Doc, DocKind } from '@/lib/dolibarr';
import { useLoad, dateFr, explain } from '@/lib/useLoad';
import { Btn, Card, Choice, Field, H2, KV, Notice, PageHead, Screen, Table } from '@/components/ui';
import { DocBadge } from '@/components/StockBadge';
import { C } from '@/theme/colors';

export default function DocCard() {
  const { t } = useTranslation();
  const { api, auth, shop } = useApp();
  const params = useLocalSearchParams<{ kind: DocKind; id: string }>();
  const kind = params.kind, id = Number(params.id);
  const da = t('common.da');
  const purchase = kind === 'supplierOrder';
  const { data, error, loading, reload } = useLoad(async () => {
    const d = await api.doc(kind, id);
    const names = await api.names([d.socid]).catch(() => ({} as Record<number, string>));
    return { d, name: names[d.socid] || '#' + d.socid };
  }, [api, kind, id]);

  const back = purchase ? { label: t('achats.title'), onPress: () => router.replace('/achats') } : { label: t('ventes.title'), onPress: () => router.replace(('/ventes?tab=' + kind) as never) };
  if (!data) return <Screen><PageHead title={loading ? t('common.loading') : t('doc.notFound')} back={back} />{error ? <Notice tone="bad">{error}</Notice> : null}</Screen>;
  const { d, name } = data;
  const paidSum = (d.payments || []).reduce((s, p) => s + p.amount, 0);

  return (
    <Screen testID="doc-screen">
      <PageHead back={back}
        title={<XStack gap={10} alignItems="center" flexWrap="wrap"><Text fontSize={24} fontWeight="700">{t('doc.kind_' + kind)} {d.ref}</Text><DocBadge kind={kind} status={d.status} paid={d.paid} remain={d.remain} total={d.total} /></XStack>}
        sub={<XStack gap={6} flexWrap="wrap"><Text color={C.accent} fontWeight="600" onPress={() => !purchase && router.push(('/clients/' + d.socid) as never)}>{name}</Text><Text color={C.muted}>· {dateFr(d.date)}{d.due ? ' · ' + t('doc.due', { d: dateFr(d.due) }) : ''}{d.refExt ? ' · ' + d.refExt : ''}</Text></XStack>} />

      <XStack gap={16} flexWrap="wrap" alignItems="flex-start">
        <YStack flexGrow={3} flexBasis={520} minWidth={0} gap={8}>
          <H2>{t('doc.lines')}</H2>
          <Table rows={d.lines} keyOf={(l) => l.ref + l.label + l.qty + l.price} minWidth={560} empty="—"
            onPress={(l) => l.productId && router.push(('/pieces/' + l.productId) as never)}
            cols={[
              { key: 'p', label: t('pieces.piece'), flex: 3, render: (l) => <YStack><Text fontWeight="600">{l.label}</Text><Text fontSize={12} color={C.muted}>{l.ref}{l.discount ? ' · −' + l.discount + ' %' : ''}</Text></YStack> },
              { key: 'q', label: t('pos.qty'), width: 70, align: 'right', render: (l) => String(l.qty) },
              { key: 'u', label: t('doc.unit'), width: 110, align: 'right', render: (l) => money(l.price, da) },
              { key: 't', label: t('common.total'), width: 120, align: 'right', render: (l) => <Text fontWeight="700">{money(l.total, da)}</Text> },
            ]} />
          {d.note && auth.cap?.seeCost ? <Card gap={4}><Text fontWeight="700" fontSize={14}>{t('doc.privateNote')}</Text><Text fontSize={14}>{d.note}</Text></Card> : null}
        </YStack>

        <Card flexGrow={1} flexBasis={280}>
          <XStack justifyContent="space-between" alignItems="baseline"><Text fontWeight="700">{t('common.total')}</Text><Text fontSize={24} fontWeight="700" testID="doc-total">{money(d.total, da)}</Text></XStack>
          {kind === 'invoice' ? <>
            <KV k={t('doc.alreadyPaid')} v={money(paidSum, da)} />
            <KV k={t('doc.remain')} v={<Text fontWeight="700" color={d.remain ? C.bad : C.ok} testID="doc-remain">{money(d.remain, da)}</Text>} />
          </> : null}
          {(d.payments || []).length ? <>
            <Text fontWeight="700" marginTop={6}>{t('doc.payments')}</Text>
            {(d.payments || []).map((p) => <XStack key={p.ref + p.date} justifyContent="space-between"><Text fontSize={14}>{dateFr(p.date)} · {t('doc.mode_' + p.type, { defaultValue: p.type })}</Text><Text fontSize={14}>{money(p.amount, da)}</Text></XStack>)}
          </> : null}
          {kind === 'invoice' && d.status === 1 && d.remain > 0 && auth.cap?.sell ? <Settle d={d} onDone={reload} cashAccount={shop.cashAccountId} bankAccount={shop.bankAccountId} /> : null}
        </Card>
      </XStack>
    </Screen>
  );
}

// Encaissement du reste dû d'une facture (client à crédit qui vient payer) : espèces sur la Caisse, chèque ou virement sur la banque.
function Settle({ d, onDone, cashAccount, bankAccount }: { d: Doc; onDone: () => void; cashAccount: number; bankAccount: number }) {
  const { t } = useTranslation();
  const { api, auth } = useApp();
  const [mode, setMode] = useState<'LIQ' | 'CHQ' | 'VIR'>('LIQ');
  const [amount, setAmount] = useState(String(Math.round(d.remain)));
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const pay = async () => {
    const n = Math.min(parseInt(amount.replace(/\D/g, ''), 10) || 0, Math.round(d.remain));
    const typeId = auth.paymentTypes?.[mode];
    if (!n || !typeId) return;
    setBusy(true); setMsg('');
    try { await api.payInvoice(d.id, n, typeId, mode === 'LIQ' ? cashAccount : bankAccount, 'CARUNO règlement ' + d.ref); onDone(); }
    catch (e) { setMsg(explain(e)); }
    finally { setBusy(false); }
  };
  return (
    <YStack gap={10} borderTopWidth={1} borderColor={C.line2} paddingTop={12}>
      <Text fontWeight="700">{t('doc.settle')}</Text>
      <Choice value={mode} onChange={setMode} options={[['LIQ', t('pay.cash')], ['CHQ', t('pay.cheque')], ['VIR', t('pay.transfer')]]} testID="settle-mode" />
      <Field label={t('session.amount')} value={amount} onChangeText={setAmount} keyboardType="number-pad" testID="settle-amount" onSubmitEditing={pay} />
      {msg ? <Notice tone="bad">{msg}</Notice> : null}
      <Btn label={busy ? t('common.loading') : t('doc.settleBtn')} variant="primary" onPress={pay} disabled={busy} testID="settle-go" />
    </YStack>
  );
}
