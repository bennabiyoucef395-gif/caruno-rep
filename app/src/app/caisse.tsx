// Caisse plein écran, pilotable au clavier sur PC :
//   recherche → Entrée ajoute la pièce (curseur sur son prix ; un code-barres scanné reste sur la recherche)
//   prix → Entrée → quantité → Entrée → recherche ; ↑ ↓ changent de ligne (prix) ou de quantité ; Échap revient à la recherche
//   Entrée sur une recherche vide : paiement (espèces pour le total) ; Entrée valide ; Entrée sur le ticket : commande suivante.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, TextInput, useWindowDimensions } from 'react-native';
import { Redirect, router } from 'expo-router';
import { Text, XStack, YStack } from 'tamagui';
import { useTranslation } from 'react-i18next';
import { useApp, money } from '@/state/app';
import type { Customer, Product } from '@/lib/dolibarr';
import { Btn, Card, Chip, Field, Notice, type InputRef } from '@/components/ui';
import { C } from '@/theme/colors';
import {
  closeSession, expectedCash, loadJournal, loadLastClose, loadSession, newId, nowText, openSession, runSale, saveSession,
  type JournalEntry, type PayMode, type Payment, type Session, type Step,
} from '@/state/register';

type Line = { p: Product; qty: number; price: number | null };
type Screen = 'products' | 'payment' | 'receipt' | 'customer' | 'close';
type Last = { mine?: { price: number; date: string }; any?: { price: number; date: string; who: string } };

const key = (e: any) => (e?.nativeEvent?.key ?? e?.key) as string;
const stop = (e: any) => { e?.preventDefault?.(); };
const digits = (v: string) => v.replace(/\D/g, '');

export default function Caisse() {
  const { t } = useTranslation();
  const { ready, auth, api, device, shop } = useApp();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const da = t('common.da');

  const [session, setSession] = useState<Session | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [lastClose, setLastClose] = useState<{ at: string; counted?: number }>({ at: '' });
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [counter, setCounter] = useState<Customer | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [hi, setHi] = useState(0);
  const [lines, setLines] = useState<Line[]>([]);
  const [sel, setSel] = useState(-1);
  const [edit, setEdit] = useState<{ k: string; txt: string } | null>(null);
  const [screen, setScreen] = useState<Screen>('products');
  const [pays, setPays] = useState<Payment[]>([]);
  const [payAuto, setPayAuto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<{ ref: string; total: number; change: number; steps: Step[]; credit: boolean } | null>(null);
  const [last, setLast] = useState<Record<number, Last>>({});
  const [recent, setRecent] = useState<any[] | null>(null);
  const [custQ, setCustQ] = useState('');
  const [custRows, setCustRows] = useState<Customer[]>([]);
  const [move, setMove] = useState<{ type: 'in' | 'out'; amount: string; reason: string } | null>(null);
  const [counted, setCounted] = useState('');
  const [openFloat, setOpenFloat] = useState(String(shop.openingFloat));
  const [focus, setFocus] = useState<string | null>('q');

  const searchRef = useRef<InputRef>(null);
  const refs = useRef<Record<string, InputRef | null>>({});
  const setRef = (k: string) => (el: InputRef | null) => { refs.current[k] = el; };

  const say = useCallback((m: string) => { setToast(m); setTimeout(() => setToast(''), 3500); }, []);

  // Écouteur clavier global (web), branché une fois ; le traitement à jour est dans keysRef.
  const keysRef = useRef<(ev: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const h = (ev: KeyboardEvent) => keysRef.current(ev);
    globalThis.addEventListener?.('keydown', h);
    return () => globalThis.removeEventListener?.('keydown', h);
  }, []);

  // Chargement : session de caisse du poste, ventes interrompues, client comptoir.
  useEffect(() => {
    if (!auth.token) return;
    (async () => {
      setSession(await loadSession());
      setLastClose(await loadLastClose() as any);
      setJournal(await loadJournal());
      try { const c = await api.customer(shop.counterCustomerId); setCounter(c); setCustomer(c); } catch { setError('Client comptoir introuvable (id ' + shop.counterCustomerId + ') : vérifiez Paramètres.'); }
      setLoaded(true);
    })();
  }, [auth.token, api, shop.counterCustomerId]);

  // Focus demandé par une action (après le rendu).
  useEffect(() => {
    if (!focus) return;
    const el = focus === 'q' ? searchRef.current : refs.current[focus];
    if (el) { el.focus(); setFocus(null); }
  });

  // Recherche Dolibarr (débit limité).
  useEffect(() => {
    const s = q.trim();
    if (s.length < 2) { setResults([]); setHi(0); return; }
    let live = true;
    const h = setTimeout(async () => { try { const r = await api.searchProducts(s, 30); if (live) { setResults(r); setHi(0); } } catch (e) { if (live) setError((e as Error).message); } }, 250);
    return () => { live = false; clearTimeout(h); };
  }, [q, api]);

  // Recherche client.
  useEffect(() => {
    if (screen !== 'customer') return;
    let live = true;
    const h = setTimeout(async () => { try { const r = await api.searchCustomers(custQ, 30); if (live) setCustRows(r); } catch (e) { if (live) setError((e as Error).message); } }, 250);
    return () => { live = false; clearTimeout(h); };
  }, [custQ, screen, api]);

  const level = customer?.priceLevel || 1;
  const refPrice = (p: Product) => p.prices[level - 1] || p.prices[0];
  const unit = (l: Line) => (l.price ?? refPrice(l.p));
  const total = useMemo(() => lines.reduce((s, l) => s + unit(l) * l.qty, 0), [lines, level]); // eslint-disable-line react-hooks/exhaustive-deps
  const isCounter = !!customer && !!counter && customer.id === counter.id;
  const levelName = t('pos.level' + level);

  // Dernier prix pratiqué pour la ligne choisie : à ce client, et dernière vente toutes clientèles.
  useEffect(() => {
    const l = lines[sel];
    if (!l || last[l.p.id]) return;
    (async () => {
      const pick = (invs: any[], pid: number) => {
        for (const inv of invs) for (const ln of inv.lines || []) if (Number(ln.fk_product) === pid) return { price: Math.round(Number(ln.subprice)), date: String(inv.date ? new Date(Number(inv.date) * 1000).toISOString().slice(0, 10) : ''), who: String(inv.socid) };
        return undefined;
      };
      try {
        let rec = recent;
        if (!rec) { rec = await api.request<any[]>('invoices', { query: { sortfield: 't.datef', sortorder: 'DESC', limit: 40, status: 'valid' } }); setRecent(rec); }
        const mine = !isCounter && customer ? pick(await api.lastInvoices(customer.id), l.p.id) : undefined;
        setLast((m) => ({ ...m, [l.p.id]: { mine, any: pick(rec || [], l.p.id) } }));
      } catch { setLast((m) => ({ ...m, [l.p.id]: {} })); }
    })();
  }, [sel, lines, customer]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!ready) return null;
  if (!auth.token) return <Redirect href="/connexion" />;
  if (!auth.cap?.sell) return <Redirect href="/pieces" />;

  // ----- panier -----
  const inCart = (pid: number) => lines.filter((l) => l.p.id === pid).reduce((s, l) => s + l.qty, 0);
  const addProduct = (p: Product, toPrice: boolean) => {
    if (inCart(p.id) >= p.stock) { say(t('pos.noStock', { ref: p.ref })); return; }
    const i = lines.findIndex((l) => l.p.id === p.id && l.price === null);
    let idx = i;
    if (i >= 0) setLines(lines.map((l, k) => (k === i ? { ...l, qty: l.qty + 1 } : l)));
    else { setLines([...lines, { p, qty: 1, price: null }]); idx = lines.length; }
    setSel(idx); setQ(''); setResults([]); setEdit(null); setPays([]);
    setFocus(toPrice ? 'price-' + idx : 'q');
  };
  const setLine = (i: number, patch: Partial<Line>) => { setLines(lines.map((l, k) => (k === i ? { ...l, ...patch } : l))); setPays([]); };
  const removeLine = (i: number) => { const next = lines.filter((_, k) => k !== i); setLines(next); setSel(Math.min(i, next.length - 1)); setEdit(null); setPays([]); setFocus('q'); };
  const maxQty = (i: number) => lines[i].p.stock - lines.filter((l, k) => k !== i && l.p.id === lines[i].p.id).reduce((s, l) => s + l.qty, 0);

  const onSearchEnter = async () => {
    const s = q.trim();
    if (!s) { if (lines.length) goPay(); return; }
    let list = results;
    if (!list.length) { try { list = await api.searchProducts(s, 30); setResults(list); } catch (e) { setError((e as Error).message); return; } }
    const ean = list.find((p) => p.barcode && p.barcode === s);
    if (ean) { addProduct(ean, false); return; }
    const p = list[hi] || list[0];
    if (!p) { say(t('pos.noResult', { q: s })); return; }
    addProduct(p, true);
  };

  const onSearchKey = (e: any) => {
    const k = key(e);
    if (k === 'ArrowDown' || k === 'ArrowUp') {
      stop(e);
      const d = k === 'ArrowDown' ? 1 : -1;
      if (q.trim()) setHi((h) => Math.max(0, Math.min(results.length - 1, h + d)));
      else if (lines.length) { const n = Math.max(0, Math.min(lines.length - 1, (sel < 0 ? (d > 0 ? -1 : lines.length) : sel) + d)); setSel(n); setEdit(null); setFocus('price-' + n); }
    } else if (k === 'Escape') { stop(e); setQ(''); }
  };

  const onPriceKey = (i: number) => (e: any) => {
    const k = key(e);
    if (k === 'Escape') { stop(e); setEdit(null); setFocus('q'); }
    else if (k === 'ArrowDown' || k === 'ArrowUp') { stop(e); const n = Math.max(0, Math.min(lines.length - 1, i + (k === 'ArrowDown' ? 1 : -1))); setEdit(null); setSel(n); setFocus('price-' + n); }
  };
  const onQtyKey = (i: number) => (e: any) => {
    const k = key(e);
    if (k === 'Escape') { stop(e); setEdit(null); setFocus('q'); }
    else if (k === 'ArrowUp' || k === 'ArrowDown') { stop(e); const n = lines[i].qty + (k === 'ArrowUp' ? 1 : -1); if (n >= 1 && n <= maxQty(i)) setLine(i, { qty: n }); setEdit(null); }
  };

  const setPriceText = (i: number, v: string) => {
    const txt = digits(v);
    setEdit({ k: 'price-' + i, txt });
    const n = txt === '' ? null : Number(txt);
    setLine(i, { price: n === null || n === refPrice(lines[i].p) ? null : n });
  };
  const setQtyText = (i: number, v: string) => {
    const txt = digits(v);
    setEdit({ k: 'qty-' + i, txt });
    const n = parseInt(txt, 10);
    if (!n) return;
    const max = maxQty(i);
    if (n > max) { setLine(i, { qty: max }); setEdit({ k: 'qty-' + i, txt: String(max) }); say(t('pos.noStock', { ref: lines[i].p.ref })); }
    else setLine(i, { qty: n });
  };
  const val = (k: string, v: number) => (edit && edit.k === k ? edit.txt : String(v));

  // ----- paiement -----
  const goPay = () => {
    if (!lines.length) return;
    setPays([{ mode: 'LIQ', amount: total }]); setPayAuto(true); setScreen('payment'); setEdit(null); setFocus('pay-0');
  };
  const paid = pays.reduce((s, p) => s + p.amount, 0);
  const cash = pays.filter((p) => p.mode === 'LIQ').reduce((s, p) => s + p.amount, 0);
  const rest = total - paid;
  const change = rest < 0 ? -rest : 0;
  const payProblem = rest > 0 ? 'due' : change > cash ? t('pay.onlyCashOver') : pays.some((p) => p.mode === 'CREDIT') && isCounter ? t('pay.creditNeedsCustomer') : '';
  const pickMode = (mode: PayMode) => {
    if (payAuto && pays.length === 1) { setPays([{ mode, amount: total }]); setFocus('pay-0'); return; }
    setPays([...pays, { mode, amount: Math.max(0, rest) }]); setPayAuto(false); setFocus('pay-' + pays.length);
  };

  const validate = async () => {
    if (payProblem || busy) return;
    setBusy(true); setError('');
    const note = lines.filter((l) => l.price !== null).map((l) => l.p.ref + ' : ' + refPrice(l.p) + ' → ' + unit(l) + ' DA — ' + (auth.me?.name || '')).join('\n');
    const entry: JournalEntry = {
      sale: newId('V'), time: nowText(), device: device.deviceName, customerId: customer!.id,
      lines: lines.map((l) => ({ productId: l.p.id, ref: l.p.ref, label: l.p.label, qty: l.qty, price: unit(l) })),
      pays: pays.map((p) => (p.mode === 'LIQ' ? { ...p, amount: p.amount - change } : p)).filter((p) => p.amount > 0),
      total, step: 'create', notePrivate: note || undefined,
    };
    try {
      const r = await runSale(api, { warehouseId: shop.warehouseId, cashAccountId: shop.cashAccountId, paymentTypes: auth.paymentTypes }, entry);
      if (session) {
        const s = { ...session, count: session.count + 1, total: session.total + total, byMode: { ...session.byMode } };
        for (const p of entry.pays) s.byMode[p.mode] = (s.byMode[p.mode] || 0) + p.amount;
        setSession(s); await saveSession(s);
      }
      setReceipt({ ref: r.invoiceRef, total, change, steps: r.steps, credit: entry.pays.some((p) => p.mode === 'CREDIT') });
      setLines([]); setSel(-1); setPays([]); setScreen('receipt'); setLast({});
    } catch (e) {
      setError((e as Error).message + ' — la vente reste dans le journal du poste, elle pourra être reprise.');
      setJournal(await loadJournal());
    } finally { setBusy(false); }
  };

  const resume = async (j: JournalEntry) => {
    setBusy(true); setError('');
    try {
      const r = await runSale(api, { warehouseId: shop.warehouseId, cashAccountId: shop.cashAccountId, paymentTypes: auth.paymentTypes }, j);
      setReceipt({ ref: r.invoiceRef, total: j.total, change: 0, steps: r.steps, credit: j.pays.some((p) => p.mode === 'CREDIT') });
      setScreen('receipt');
    } catch (e) { setError((e as Error).message); }
    finally { setJournal(await loadJournal()); setBusy(false); }
  };

  const nextOrder = () => { setReceipt(null); setScreen('products'); setCustomer(counter); setFocus('q'); };

  // Clavier hors champ de saisie (web) : Entrée sur le ticket, Échap sur le paiement.
  keysRef.current = (ev: KeyboardEvent) => {
    const tag = (ev.target as HTMLElement)?.tagName || '';
    if (screen === 'receipt' && ev.key === 'Enter' && !/INPUT|TEXTAREA|BUTTON/.test(tag)) { ev.preventDefault(); nextOrder(); }
    if (screen === 'payment' && ev.key === 'Escape') { ev.preventDefault(); setScreen('products'); setFocus('q'); }
  };

  // ----- écrans -----
  const top = (
    <XStack backgroundColor={C.dark} paddingHorizontal={10} minHeight={58} alignItems="center" gap={8}>
      <Btn label={'‹ ' + t('nav.backOffice')} variant="dark" onPress={() => router.push('/pieces')} style={{ borderColor: '#3A3E48', backgroundColor: 'transparent' }} testID="pos-backoffice" />
      <Text color="#fff" fontSize={17} fontWeight="700" letterSpacing={2} paddingHorizontal={6}>CARUNO</Text>
      <YStack flex={1} />
      {toast ? <Text color="#FFD7B5" fontSize={13} numberOfLines={1} testID="pos-toast">{toast}</Text> : null}
      <Text color="#C9CBD2" fontSize={12} textAlign="right">{session ? t('pos.session', { t: session.openedAt.slice(11) }) : t('pos.sessionClosed')}{'\n'}{auth.me?.name} · {device.deviceName}</Text>
      {session ? <>
        <Btn label={t('session.moveTitle')} variant="dark" onPress={() => setMove({ type: 'in', amount: '', reason: '' })} style={{ borderColor: '#3A3E48', backgroundColor: 'transparent' }} />
        <Btn label={t('session.close')} variant="dark" onPress={() => { setCounted(String(expectedCash(session))); setScreen('close'); }} style={{ borderColor: '#3A3E48', backgroundColor: 'transparent' }} testID="pos-close" />
      </> : null}
    </XStack>
  );

  const frame = (body: React.ReactNode) => (
    <YStack flex={1} backgroundColor={C.bg}>
      {top}
      {error ? <YStack padding={10}><Notice tone="bad">{error}</Notice></YStack> : null}
      {journal.length && screen === 'products' ? (
        <YStack padding={10} gap={6}>
          {journal.map((j) => (
            <XStack key={j.sale} backgroundColor={C.warnBg} borderRadius={10} padding={10} alignItems="center" gap={10}>
              <Text flex={1} color="#5C2A06">{t('resume.text', { sale: j.sale, t: j.time.slice(11), step: t(j.step === 'create' ? 'resume.stepCreate' : j.step === 'validate' ? 'resume.stepValidate' : 'resume.stepPay'), v: money(j.total, da) })}</Text>
              <Btn label={t('resume.resume')} variant="dark" onPress={() => resume(j)} disabled={busy} testID="pos-resume" />
            </XStack>
          ))}
        </YStack>
      ) : null}
      {body}
      {move ? (
        <YStack position="absolute" top={0} left={0} right={0} bottom={0} backgroundColor="rgba(0,0,0,.45)" alignItems="center" justifyContent="center" padding={16}>
          <Card width="100%" maxWidth={480}>
            <Text fontSize={18} fontWeight="700">{t('session.moveTitle')}</Text>
            <XStack gap={8}><Chip label={t('session.moveIn')} active={move.type === 'in'} onPress={() => setMove({ ...move, type: 'in' })} /><Chip label={t('session.moveOut')} active={move.type === 'out'} onPress={() => setMove({ ...move, type: 'out' })} /></XStack>
            <XStack gap={10}><Field label={t('session.amount')} value={move.amount} onChangeText={(v) => setMove({ ...move, amount: digits(v) })} keyboardType="number-pad" autoFocus /><Field label={t('session.reason')} value={move.reason} onChangeText={(v) => setMove({ ...move, reason: v })} /></XStack>
            <XStack gap={8} justifyContent="flex-end">
              <Btn label={t('common.cancel')} onPress={() => setMove(null)} />
              <Btn label={t('common.save')} variant="primary" disabled={!Number(move.amount) || !move.reason.trim()} onPress={async () => {
                if (!session) return;
                const s = { ...session, moves: [...session.moves, { at: nowText(), type: move.type, amount: Number(move.amount), reason: move.reason.trim() }] };
                setSession(s); await saveSession(s); setMove(null); setFocus('q');
              }} />
            </XStack>
          </Card>
        </YStack>
      ) : null}
    </YStack>
  );

  if (!loaded) return frame(<YStack padding={24}><Text color={C.muted}>{t('common.loading')}</Text></YStack>);

  // Caisse fermée : ouverture avec le fond compté.
  if (!session) return frame(
    <YStack padding={24} alignItems="center">
      <Card width="100%" maxWidth={480}>
        <Text fontSize={22} fontWeight="700">{t('session.openTitle')}</Text>
        {lastClose.at ? <Text color={C.muted} fontSize={13}>{t('session.lastClose', { t: lastClose.at, v: money(lastClose.counted || 0, da) })}</Text> : null}
        <Field label={t('session.float')} value={openFloat} onChangeText={(v) => setOpenFloat(digits(v))} keyboardType="number-pad" big autoFocus onSubmitEditing={async () => { const s = openSession(auth.me?.name || '', Number(openFloat) || 0); setSession(s); await saveSession(s); setFocus('q'); }} testID="pos-float" />
        <Btn label={t('session.open')} variant="primary" big testID="pos-open" onPress={async () => { const s = openSession(auth.me?.name || '', Number(openFloat) || 0); setSession(s); await saveSession(s); setFocus('q'); }} />
      </Card>
    </YStack>
  );

  if (screen === 'close') {
    const exp = expectedCash(session);
    const cnt = Number(counted) || 0;
    const ins = session.moves.filter((m) => m.type === 'in').reduce((s, m) => s + m.amount, 0);
    const outs = session.moves.filter((m) => m.type === 'out').reduce((s, m) => s + m.amount, 0);
    const row = (a: string, b: string, bold?: boolean) => <XStack justifyContent="space-between"><Text fontWeight={bold ? '700' : '400'}>{a}</Text><Text fontWeight={bold ? '700' : '400'}>{b}</Text></XStack>;
    return frame(
      <ScrollView contentContainerStyle={{ padding: 20, alignItems: 'center' }}>
        <Card width="100%" maxWidth={560}>
          <Text fontSize={22} fontWeight="700">{t('session.closeTitle')} · {session.id}</Text>
          {row(t('session.sales'), String(session.count) + ' · ' + money(session.total, da))}
          {row(t('pay.cash'), money(session.byMode.LIQ || 0, da))}{row(t('pay.cheque'), money(session.byMode.CHQ || 0, da))}{row(t('pay.transfer'), money(session.byMode.VIR || 0, da))}{row(t('pay.credit'), money(session.byMode.CREDIT || 0, da))}
          {row(t('session.float'), money(session.opening, da))}{row('+ ' + t('session.moveIn'), money(ins, da))}{row('− ' + t('session.moveOut'), money(outs, da))}
          {row(t('session.expected'), money(exp, da), true)}
          <Field label={t('session.counted')} value={counted} onChangeText={(v) => setCounted(digits(v))} keyboardType="number-pad" big testID="pos-counted" />
          {row(t('session.diff'), (cnt - exp > 0 ? '+' : '') + money(cnt - exp, da), true)}
          {journal.length ? <Notice tone="bad">{t('resume.title')} : {journal.map((j) => j.sale).join(', ')}</Notice> : null}
          <XStack gap={8} justifyContent="flex-end">
            <Btn label={t('common.back')} onPress={() => { setScreen('products'); setFocus('q'); }} />
            <Btn label={busy ? t('common.loading') : t('session.close')} variant="primary" disabled={busy || journal.length > 0} testID="pos-close-confirm" onPress={async () => {
              setBusy(true); setError('');
              try {
                const r = await closeSession(api, session, cnt, { userId: auth.me!.id, canBank: !!auth.cap?.bank, cashAccountId: shop.cashAccountId, device: device.deviceName });
                say(t('session.report') + ' ' + (r.bankWritten ? t('session.bankWritten') : t('session.bankPending')));
                setSession(null); setLastClose({ at: nowText(), counted: cnt }); setScreen('products');
              } catch (e) { setError((e as Error).message); }
              finally { setBusy(false); }
            }} />
          </XStack>
        </Card>
      </ScrollView>
    );
  }

  if (screen === 'receipt' && receipt) return frame(
    <ScrollView contentContainerStyle={{ padding: 24, alignItems: 'center' }}>
      <Card width="100%" maxWidth={560}>
        <Text fontSize={22} fontWeight="700" testID="pos-receipt">{receipt.credit ? t('receipt.validated') : t('receipt.success')}</Text>
        <Text color={C.muted}>{receipt.ref} · {money(receipt.total, da)}</Text>
        {receipt.change ? <YStack alignItems="center" padding={10} backgroundColor={C.okBg} borderRadius={12}><Text color={C.muted}>{t('receipt.change')}</Text><Text fontSize={40} fontWeight="700" color={C.ok}>{money(receipt.change, da)}</Text></YStack> : null}
        <YStack gap={4}><Text fontWeight="600" color={C.muted}>{t('receipt.steps')}</Text>{receipt.steps.map((s, i) => <Text key={i} fontSize={13} color={s.skip ? C.muted : C.ink}>{t(s.key, s.vars)}</Text>)}</YStack>
        <Btn label={t('receipt.next')} variant="primary" big onPress={nextOrder} testID="pos-next" />
        <Text fontSize={12} color={C.muted} textAlign="center">{t('keys.enter')} : {t('receipt.hintNext')}</Text>
      </Card>
    </ScrollView>
  );

  if (screen === 'customer') return frame(
    <YStack padding={20} gap={12} flex={1}>
      <XStack gap={10} alignItems="center"><Btn label={'‹ ' + t('common.back')} onPress={() => { setScreen('products'); setFocus('q'); }} /><Text fontSize={20} fontWeight="700">{t('pos.changeCustomer')}</Text></XStack>
      <Field value={custQ} onChangeText={setCustQ} placeholder={t('common.search')} autoFocus />
      <ScrollView style={{ backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.line }}>
        {custRows.map((c) => (
          <Pressable key={c.id} onPress={() => { setCustomer(c); setPays([]); setLast({}); setScreen('products'); setFocus('q'); }} style={({ pressed }) => ({ padding: 12, borderBottomWidth: 1, borderColor: C.line2, backgroundColor: c.id === customer?.id ? C.selected : pressed ? C.soft : C.surface })}>
            <Text fontWeight="600">{c.name}</Text>
            <Text fontSize={12} color={C.muted}>{[t('pos.levelLabel', { name: t('pos.level' + c.priceLevel) }), c.town, c.phone].filter(Boolean).join(' · ')}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </YStack>
  );

  if (screen === 'payment') {
    const methods: { mode: PayMode; label: string; ok: boolean }[] = [
      { mode: 'LIQ', label: t('pay.cash'), ok: true }, { mode: 'CHQ', label: t('pay.cheque'), ok: true }, { mode: 'VIR', label: t('pay.transfer'), ok: true }, { mode: 'CREDIT', label: t('pay.credit'), ok: !isCounter },
    ];
    const others = (i: number) => pays.reduce((s, p, k) => s + (k === i ? 0 : p.amount), 0);
    const suggest = (due: number) => { const out = [due]; [500, 1000, 2000, 5000].forEach((b) => { const v = Math.ceil(due / b) * b; if (!out.includes(v)) out.push(v); }); return out.slice(0, 4); };
    return frame(
      <ScrollView contentContainerStyle={{ padding: 18, gap: 14 }}>
        <XStack gap={10} alignItems="center"><Btn label={'‹ ' + t('common.back')} onPress={() => { setScreen('products'); setFocus('q'); }} /><Text fontSize={22} fontWeight="700">{t('pay.title')}</Text></XStack>
        <XStack gap={18} flexWrap="wrap" alignItems="flex-start">
          <YStack width={wide ? 240 : '100%'} gap={8}>
            {methods.map((m) => <Btn key={m.mode} label={m.label} disabled={!m.ok} onPress={() => pickMode(m.mode)} style={{ minHeight: 56, justifyContent: 'flex-start' }} testID={'pay-mode-' + m.mode} />)}
          </YStack>
          <YStack flex={1} minWidth={280} gap={10}>
            <Card alignItems="center" gap={4}>
              <Text color={C.muted}>{rest > 0 ? t('pay.due') : change ? t('pay.change') : t('pay.settled')}</Text>
              <Text fontSize={42} fontWeight="700" color={rest > 0 ? C.ink : C.ok} testID="pay-big">{money(rest > 0 ? rest : change || total, da)}</Text>
              <Text color={C.muted}>{t('pay.totalToPay', { v: money(total, da) })}</Text>
            </Card>
            {pays.map((p, i) => (
              <Card key={i} gap={8}>
                <XStack gap={8} alignItems="center">
                  <Text flex={1} fontSize={16} fontWeight="600">{methods.find((m) => m.mode === p.mode)?.label}</Text>
                  <TextInput ref={setRef('pay-' + i)} testID={'pay-amt-' + i} value={val('pay-' + i, p.amount)} keyboardType="number-pad" selectTextOnFocus
                    onChangeText={(v) => { const txt = digits(v); setEdit({ k: 'pay-' + i, txt }); setPays(pays.map((x, k) => (k === i ? { ...x, amount: Number(txt) || 0 } : x))); setPayAuto(false); }}
                    onSubmitEditing={validate} onKeyPress={(e) => { if (key(e) === 'Escape') { stop(e); setScreen('products'); setFocus('q'); } }} submitBehavior="submit"
                    style={{ width: 150, minHeight: 50, borderWidth: 1, borderColor: '#CFD0CA', borderRadius: 10, paddingHorizontal: 10, fontSize: 18, fontWeight: '700', textAlign: 'right', backgroundColor: C.surface }} />
                  <Btn label="✕" onPress={() => { setPays(pays.filter((_, k) => k !== i)); setPayAuto(false); }} />
                </XStack>
                {p.mode === 'LIQ' ? <XStack gap={6} flexWrap="wrap" alignItems="center"><Text fontSize={13} color={C.muted}>{t('pay.received')}</Text>{suggest(Math.max(0, total - others(i))).map((v, k) => <Chip key={v} label={k === 0 ? t('pay.exact') : money(v, da)} active={p.amount === v} onPress={() => { setPays(pays.map((x, kk) => (kk === i ? { ...x, amount: v } : x))); setPayAuto(false); setEdit(null); }} />)}</XStack> : null}
              </Card>
            ))}
            {payAuto ? <Text fontSize={13} color={C.muted}>{t('pay.defaultCash')}</Text> : null}
            <Text fontSize={12} color={C.muted}>{t('pay.hintEnter')} · {t('keys.esc')} : {t('pay.hintEsc')}</Text>
          </YStack>
          <YStack width={wide ? 300 : '100%'} gap={10}>
            <Card padded><Text fontWeight="700">{customer?.name}</Text><Text fontSize={12} color={C.muted}>{t('pos.levelLabel', { name: levelName })}</Text></Card>
            {payProblem && payProblem !== 'due' ? <Notice tone="bad">{payProblem}</Notice> : null}
            <Btn label={busy ? t('pay.working') : t('pay.validate')} variant="primary" big disabled={!!payProblem || busy} onPress={validate} style={{ minHeight: 72 }} testID="pay-validate" />
          </YStack>
        </XStack>
      </ScrollView>
    );
  }

  // ----- écran pièces + panier -----
  const tt = (v: number) => money(v, da);
  const lineEdit = (l: Line, i: number) => {
    const cur = unit(l), ref = refPrice(l.p), ls = last[l.p.id] || {};
    const dm = (d: string) => d.slice(8, 10) + '/' + d.slice(5, 7);
    const opts: [string, number][] = [[t('pos.quickPublic'), l.p.prices[0]], [t('pos.quickGros'), l.p.prices[2]]];
    if (ref !== l.p.prices[0] && ref !== l.p.prices[2]) opts.push([t('pos.quickCustomer'), ref]);
    if (ls.mine) opts.push([t('pos.quickLastCustomer', { d: dm(ls.mine.date) }), ls.mine.price]);
    if (ls.any) opts.push(['Dernière vente · ' + dm(ls.any.date), ls.any.price]);
    const r100 = Math.floor(cur / 100) * 100; if (r100 > 0 && r100 !== cur) opts.push([t('pos.quickRound'), r100]);
    const seen = new Set<number>(); const chips = opts.filter(([, v]) => v > 0 && !seen.has(v) && (seen.add(v), true));
    const pct = ref ? Math.round((cur - ref) / ref * 1000) / 10 : 0;
    return (
      <YStack gap={8} paddingHorizontal={14} paddingBottom={12} backgroundColor={C.selected} borderLeftWidth={4} borderColor={C.accent}>
        <XStack gap={8} alignItems="flex-end">
          <YStack flex={1} gap={4}>
            <Text fontSize={12} fontWeight="600" color="#3D414C">{t('pos.price')}</Text>
            <TextInput ref={setRef('price-' + i)} testID={'price-' + i} value={val('price-' + i, cur)} keyboardType="number-pad" selectTextOnFocus submitBehavior="submit"
              onChangeText={(v) => setPriceText(i, v)} onSubmitEditing={() => { setEdit(null); setFocus('qty-' + i); }} onKeyPress={onPriceKey(i)} onBlur={() => setEdit(null)}
              style={{ minHeight: 46, borderWidth: 1, borderColor: '#CFD0CA', borderRadius: 10, paddingHorizontal: 10, fontSize: 22, fontWeight: '700', textAlign: 'right', backgroundColor: C.surface }} />
          </YStack>
          <YStack gap={4}>
            <Text fontSize={12} fontWeight="600" color="#3D414C">{t('pos.qty')}</Text>
            <XStack borderWidth={1} borderColor="#CFD0CA" borderRadius={10} backgroundColor={C.surface} alignItems="center">
              <Pressable accessibilityLabel="-1" onPress={() => { if (l.qty > 1) setLine(i, { qty: l.qty - 1 }); }} style={{ width: 40, height: 44, alignItems: 'center', justifyContent: 'center' }}><Text fontSize={20}>−</Text></Pressable>
              <TextInput ref={setRef('qty-' + i)} testID={'qty-' + i} value={val('qty-' + i, l.qty)} keyboardType="number-pad" selectTextOnFocus submitBehavior="submit"
                onChangeText={(v) => setQtyText(i, v)} onSubmitEditing={() => { setEdit(null); setFocus('q'); }} onKeyPress={onQtyKey(i)} onBlur={() => setEdit(null)}
                style={{ width: 44, textAlign: 'center', fontSize: 16, fontWeight: '700', minHeight: 40 }} />
              <Pressable accessibilityLabel="+1" onPress={() => { if (l.qty < maxQty(i)) setLine(i, { qty: l.qty + 1 }); }} style={{ width: 40, height: 44, alignItems: 'center', justifyContent: 'center' }}><Text fontSize={20}>+</Text></Pressable>
            </XStack>
          </YStack>
          <Btn label="✕" accessibilityLabel={t('pos.remove')} onPress={() => removeLine(i)} />
        </XStack>
        <XStack gap={6} flexWrap="wrap">
          {chips.map(([label, v]) => <Chip key={label} sub={label} label={tt(v)} active={v === cur} onPress={() => { setLine(i, { price: v === ref ? null : v }); setEdit(null); setFocus('price-' + i); }} />)}
          {auth.cap?.seeCost ? <YStack borderWidth={1} borderStyle="dashed" borderColor="#CFD0CA" borderRadius={10} paddingHorizontal={10} paddingVertical={4} justifyContent="center"><Text fontSize={11} color={C.muted}>{t('pos.purchase')}</Text><Text fontSize={14} fontWeight="700">{tt(l.p.cost)}</Text></YStack> : null}
        </XStack>
        <Text fontSize={13} color={C.muted}>
          {!ref ? t('pos.noRefPrice', { ref: levelName }) : cur !== ref ? t('pos.vsRef', { pct: (pct > 0 ? '+' : '') + String(pct).replace('.', ',') + ' %', ref: levelName }) : t('pos.refPrice', { ref: levelName })}
          {l.p.minPrice && cur < l.p.minPrice ? ' · ' + t('pos.belowMin', { v: tt(l.p.minPrice) }) : ''}
        </Text>
      </YStack>
    );
  };

  const order = (
    <YStack width={wide ? 420 : '100%'} backgroundColor={C.surface} borderRightWidth={wide ? 1 : 0} borderColor={C.line}>
      <Pressable onPress={() => { setCustQ(''); setScreen('customer'); }} style={{ margin: 8, padding: 10, borderWidth: 1, borderColor: C.line, borderRadius: 10, backgroundColor: C.soft }} testID="pos-customer">
        <Text fontWeight="700">{customer?.name || '…'}</Text>
        <Text fontSize={12} color={C.muted}>{t('pos.levelLabel', { name: levelName })} — {t('pos.changeCustomer')} ›</Text>
      </Pressable>
      <ScrollView style={{ flex: 1 }}>
        {lines.length ? lines.map((l, i) => (
          <YStack key={i} borderBottomWidth={1} borderColor={C.line2}>
            <Pressable onPress={() => { setSel(i); setEdit(null); setFocus('price-' + i); }} testID={'line-' + i}
              style={{ flexDirection: 'row', gap: 10, padding: 12, borderLeftWidth: 4, borderColor: i === sel ? C.accent : 'transparent', backgroundColor: i === sel ? C.selected : C.surface }}>
              <YStack flex={1} minWidth={0}>
                <Text fontWeight="700" fontSize={14} numberOfLines={1}>{l.p.label}</Text>
                <Text fontSize={12} color={C.muted} numberOfLines={1}>{[l.p.brand, l.p.ref].filter(Boolean).join(' ')}</Text>
                <Text fontSize={13}>{l.qty} × {tt(unit(l))}{l.price !== null && refPrice(l.p) > 0 ? <Text color={C.accentInk}>  ({tt(refPrice(l.p))})</Text> : null}</Text>
              </YStack>
              <Text fontWeight="700" fontSize={15}>{tt(unit(l) * l.qty)}</Text>
            </Pressable>
            {i === sel ? lineEdit(l, i) : null}
          </YStack>
        )) : <Text padding={30} color={C.muted} textAlign="center">{t('pos.emptyCart')}</Text>}
      </ScrollView>
      <XStack justifyContent="space-between" alignItems="baseline" paddingHorizontal={14} paddingVertical={10} borderTopWidth={1} borderColor={C.line}>
        <Text fontWeight="700">{t('common.total')}</Text><Text fontSize={26} fontWeight="700" testID="pos-total">{tt(total)}</Text>
      </XStack>
      <YStack padding={10}><Btn label={t('pos.pay') + '   ' + tt(total)} variant="primary" big disabled={!lines.length} onPress={goPay} style={{ minHeight: 62 }} testID="pos-pay" /></YStack>
    </YStack>
  );

  const products = (
    <YStack flex={1} minWidth={0}>
      <YStack padding={10} gap={6} backgroundColor={C.surface} borderBottomWidth={1} borderColor={C.line2}>
        <TextInput ref={searchRef} testID="pos-q" value={q} onChangeText={setQ} placeholder={t('pos.searchPlaceholder')} placeholderTextColor="#8A8F9C" autoFocus autoCapitalize="none" autoCorrect={false}
          onSubmitEditing={onSearchEnter} onKeyPress={onSearchKey} submitBehavior="submit"
          style={{ minHeight: 50, borderWidth: 2, borderColor: C.ink, borderRadius: 12, paddingHorizontal: 14, fontSize: 17, backgroundColor: C.surface }} />
        {Platform.OS === 'web' && wide ? <Text fontSize={12} color={C.muted}>{t('keys.enter')} : {t('pos.hintAdd')} → {t('pos.qty').toLowerCase()} → {t('pos.hintEsc')} · ↑↓ : {t('pos.hintMove')} · {t('keys.enter')} {t('pos.hintPay')} · {t('keys.esc')} : {t('pos.hintEsc')}</Text> : null}
      </YStack>
      <ScrollView contentContainerStyle={{ padding: 10, gap: 6 }}>
        {results.map((p, k) => {
          const off = p.stock - inCart(p.id) <= 0;
          return (
            <Pressable key={p.id} testID={'res-' + k} onPress={() => addProduct(p, true)}
              style={({ pressed }) => ({ flexDirection: 'row', gap: 10, alignItems: 'center', padding: 10, borderRadius: 12, borderWidth: k === hi ? 2 : 1, borderColor: k === hi ? C.accent : C.line, backgroundColor: pressed ? C.soft : C.surface, opacity: off ? 0.6 : 1 })}>
              <YStack flex={1} minWidth={0}>
                <Text fontWeight="600" numberOfLines={1}>{p.label}</Text>
                <Text fontSize={12} color={C.muted} numberOfLines={1}>{[p.brand, p.ref, p.oem && 'OEM ' + p.oem].filter(Boolean).join(' · ')}</Text>
              </YStack>
              <Text fontSize={12} fontWeight="600" color={off ? C.bad : C.ok}>{off ? t('pos.outOfStock') : t('pos.stockLeft', { n: p.stock })}</Text>
              <Text width={100} textAlign="right" fontWeight="700">{tt(refPrice(p))}</Text>
            </Pressable>
          );
        })}
        {q.trim().length >= 2 && !results.length ? <Text color={C.muted} padding={16}>{t('pos.noResult', { q })}</Text> : null}
      </ScrollView>
    </YStack>
  );

  return frame(<XStack flex={1} flexDirection={wide ? 'row' : 'column-reverse'}>{order}{products}</XStack>);
}
