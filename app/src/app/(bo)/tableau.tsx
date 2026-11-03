// Tableau de bord : chiffre du jour et du mois (factures Dolibarr), ventes par vendeur, caisse de ce poste,
// impayés, alertes de stock et ventes interrompues à reprendre.
import { router } from 'expo-router';
import { Text, XStack, YStack } from 'tamagui';
import { useTranslation } from 'react-i18next';
import { useApp, money } from '@/state/app';
import { useLoad, isoDay } from '@/lib/useLoad';
import { expectedCash, loadJournal, loadLastClose, loadSession } from '@/state/register';
import { Btn, Card, H2, Kpi, Notice, PageHead, Screen } from '@/components/ui';
import { C } from '@/theme/colors';

export default function Tableau() {
  const { t, i18n } = useTranslation();
  const { api, auth } = useApp();
  const da = t('common.da');
  const now = new Date();
  const monthStart = isoDay(new Date(now.getFullYear(), now.getMonth(), 1));

  const { data, error, loading } = useLoad(async () => {
    const [month, unpaid, alerts, users, session, journal, lastClose] = await Promise.all([
      auth.cap?.invoices ? api.invoicesSince(monthStart) : Promise.resolve([]),
      auth.cap?.invoices ? api.listDocs('invoice', { unpaid: true, limit: 200 }).then((r) => r.items).catch(() => []) : Promise.resolve([]),
      api.stockAlerts().catch(() => []),
      auth.cap?.users ? api.users().catch(() => []) : Promise.resolve([]),
      loadSession(), loadJournal(), loadLastClose(),
    ]);
    return { month, unpaid, alerts, users, session, journal, lastClose };
  }, [api, monthStart]);

  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000;
  const sign = (d: { kind: string; total: number }) => (d.kind === 'credit' ? -Math.abs(d.total) : d.total);
  const ofDay = (data?.month || []).filter((d) => d.date >= dayStart);
  const caDay = ofDay.reduce((s, d) => s + sign(d), 0);
  const caMonth = (data?.month || []).reduce((s, d) => s + sign(d), 0);
  const sales = ofDay.filter((d) => d.kind === 'invoice').length;
  const owed = (data?.unpaid || []).reduce((s, d) => s + d.remain, 0);
  const late = (data?.unpaid || []).filter((d) => d.due && d.due < now.getTime() / 1000).length;

  // Ventes du jour par vendeur (auteur de la facture).
  const bySeller: Record<number, { v: number; n: number }> = {};
  for (const d of ofDay) { const k = d.author; bySeller[k] = bySeller[k] || { v: 0, n: 0 }; bySeller[k].v += sign(d); if (d.kind === 'invoice') bySeller[k].n++; }
  const sellers = Object.entries(bySeller).map(([id, x]) => ({ id: Number(id), ...x, name: data?.users.find((u) => u.id === Number(id))?.name || (Number(id) === auth.me?.id ? auth.me?.name : '#' + id) })).sort((a, b) => b.v - a.v);
  const max = Math.max(1, ...sellers.map((s) => s.v));
  const dateLabel = now.toLocaleDateString(i18n.language === 'ar' ? 'ar-DZ' : i18n.language === 'en' ? 'en-GB' : 'fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <Screen testID="tableau-screen">
      <PageHead title={t('dash.title')} sub={dateLabel} />
      {error ? <Notice tone="bad">{error}</Notice> : null}
      <XStack gap={16} flexWrap="wrap">
        <Kpi label={t('dash.caDay')} value={loading ? '…' : money(caDay, da)} sub={t('dash.salesCount', { n: sales, avg: money(sales ? caDay / sales : 0, da) })} />
        <Kpi label={t('dash.caMonth')} value={loading ? '…' : money(caMonth, da)} sub={t('dash.invoicesCount', { n: (data?.month || []).length })} />
        <Kpi label={t('dash.unpaid')} value={loading ? '…' : money(owed, da)} sub={t('dash.late', { n: late })} />
        <Kpi label={t('dash.alerts')} value={loading ? '…' : String(data?.alerts.length ?? 0)} sub={t('dash.alertsSub')} />
      </XStack>

      <XStack gap={16} flexWrap="wrap" alignItems="flex-start">
        <Card flexGrow={1} flexBasis={320}>
          <H2>{t('dash.bySeller')}</H2>
          {sellers.length ? sellers.map((s) => (
            <YStack key={s.id} gap={6}>
              <XStack justifyContent="space-between"><Text fontWeight="700">{s.name}</Text><Text>{money(s.v, da)} <Text color={C.muted}>· {t('dash.sales', { n: s.n })}</Text></Text></XStack>
              <YStack height={12} backgroundColor="#F0F0EC" borderRadius={4}><YStack height={12} width={(Math.round((Math.max(s.v, 0) / max) * 100) + '%') as never} backgroundColor={C.accent} borderRadius={4} /></YStack>
            </YStack>
          )) : <Text color={C.muted}>{t('dash.noSale')}</Text>}
        </Card>

        <Card flexGrow={1} flexBasis={320}>
          <H2>{t('dash.register')}</H2>
          {data?.session ? <>
            <Text>{t('dash.sessionOpen', { t: data.session.openedAt, by: data.session.openedBy })}</Text>
            <Notice tone="info">{t('dash.expected', { v: money(expectedCash(data.session), da), n: data.session.count })}</Notice>
          </> : <Text color={C.muted}>{t('pos.sessionClosed')}{data?.lastClose && data.lastClose.at ? ' · ' + t('session.lastClose', { t: data.lastClose.at, v: money((data.lastClose as { counted: number }).counted, da) }) : ''}</Text>}
          {auth.cap?.sell ? <Btn label={t('nav.caisse')} variant="dark" onPress={() => router.push('/caisse')} /> : null}
        </Card>

        <Card flexGrow={1} flexBasis={320}>
          <H2>{t('dash.check')}</H2>
          {(data?.journal || []).length
            ? (data?.journal || []).map((j) => <Notice key={j.sale} tone="warn">{t('dash.interrupted', { sale: j.sale, t: j.time, v: money(j.total, da) })}</Notice>)
            : <Notice tone="ok">{t('dash.noInterrupted')}</Notice>}
          {data?.alerts.length ? <Notice tone="warn">{t('dash.alertsNotice', { n: data.alerts.length })}</Notice> : null}
          {late ? <Notice tone="bad">{t('dash.lateNotice', { n: late })}</Notice> : null}
          <XStack gap={8} flexWrap="wrap">
            {auth.cap?.stock ? <Btn label={t('nav.stock')} onPress={() => router.push('/stock')} /> : null}
            {auth.cap?.invoices ? <Btn label={t('nav.reglements')} onPress={() => router.push((auth.cap?.bankRead ? '/reglements' : '/ventes?tab=invoice') as never)} /> : null}
          </XStack>
        </Card>
      </XStack>
    </Screen>
  );
}
