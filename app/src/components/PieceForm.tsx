// Formulaire de pièce (création et modification). À la création, le catalogue commun CARUNO suggère les fiches :
// la pièce garde l'identifiant catalogue (ref_ext). Après l'enregistrement, on ouvre la fiche de la pièce.
import { useEffect, useState } from 'react';
import { Pressable } from 'react-native';
import { router } from 'expo-router';
import { Text, XStack, YStack } from 'tamagui';
import { useTranslation } from 'react-i18next';
import { useApp } from '@/state/app';
import { loadCatalogue, suggest, type CatalogueItem } from '@/lib/catalogue';
import { explain, useLoad } from '@/lib/useLoad';
import type { Product } from '@/lib/dolibarr';
import { Btn, Card, Choice, Field, H2, Notice } from '@/components/ui';
import { C } from '@/theme/colors';

type F = { ref: string; label: string; brand: string; oem: string; barcode: string; p1: string; p2: string; p3: string; location: string; alert: string; desired: string; initQty: string };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const toInt = (v: string) => { const n = parseInt(v.replace(/\D/g, ''), 10); return Number.isFinite(n) ? n : 0; };

export function PieceForm({ product, preset }: { product?: Product; preset?: CatalogueItem | null }) {
  const { t } = useTranslation();
  const { api, auth, device, shop } = useApp();
  const editing = !!product;
  const [f, setF] = useState<F>(() => product ? {
    ref: product.ref, label: product.label, brand: product.brand, oem: product.oem, barcode: product.barcode,
    p1: product.prices[0] ? String(Math.round(product.prices[0])) : '', p2: product.prices[1] && product.prices[1] !== product.prices[0] ? String(Math.round(product.prices[1])) : '',
    p3: product.prices[2] && product.prices[2] !== product.prices[0] ? String(Math.round(product.prices[2])) : '', location: product.location, alert: product.alert ? String(product.alert) : '', desired: product.desired ? String(product.desired) : '', initQty: '',
  } : { ref: '', label: '', brand: '', oem: '', barcode: '', p1: '', p2: '', p3: '', location: '', alert: '', desired: '', initQty: '' });
  const [catState, setCatState] = useState<'loading' | 'ok' | 'off'>('loading');
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<CatalogueItem[]>([]);
  const [picked, setPicked] = useState<CatalogueItem | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [wh, setWh] = useState(shop.warehouseId);
  const whs = useLoad(() => (editing ? Promise.resolve([]) : api.warehouses()), [api, editing]).data || [];
  const set = (k: keyof F) => (v: string) => setF((x) => ({ ...x, [k]: v }));

  const pick = (it: CatalogueItem) => {
    setPicked(it); setHits([]); setQ('');
    setF((x) => ({ ...x, ref: it.r, label: it.l || it.d, brand: it.b, oem: it.o }));
  };
  useEffect(() => { if (editing) return; loadCatalogue(device.catalogueUrl).then(() => setCatState('ok')).catch(() => setCatState('off')); }, [device.catalogueUrl, editing]);
  useEffect(() => { setHits(catState === 'ok' ? suggest(q) : []); }, [q, catState]);
  useEffect(() => { if (preset) pick(preset); }, [preset]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!auth.cap?.createProduct) return <Notice tone="warn">{t('pieces.notAllowed')}</Notice>;

  const save = async () => {
    const prices = [toInt(f.p1), toInt(f.p2) || toInt(f.p1), toInt(f.p3) || toInt(f.p1)];
    if (!f.ref.trim() || !f.label.trim() || !prices[0]) { setMsg(t('newPiece.required')); return; }
    setBusy(true); setMsg('');
    const data = { ref: f.ref.trim(), label: f.label.trim(), brand: f.brand.trim(), oem: f.oem.trim(), barcode: f.barcode.trim(), price: prices[0], prices, location: f.location.trim(), alert: toInt(f.alert), desired: toInt(f.desired) };
    try {
      if (editing) {
        await api.updateProduct(product!.id, data);
        router.replace(('/pieces/' + product!.id) as never);
      } else {
        const id = await api.createProduct({ ...data, refExt: picked?.i });
        const qty = toInt(f.initQty);
        if (qty > 0 && auth.cap?.stockMoves) await api.addMovement(id, wh, qty, 'Stock initial CARUNO');
        router.replace(('/pieces/' + id + '?created=1') as never);
      }
    } catch (e) { setMsg(explain(e)); setBusy(false); }
  };

  return (
    <YStack gap={16}>
      {!editing ? (
        <Card>
          <H2>{t('newPiece.fromCatalogue')}</H2>
          {catState === 'loading' ? <Text color={C.muted}>{t('newPiece.loadingCatalogue')}</Text> : null}
          {catState === 'off' ? <Notice tone="warn">{t('newPiece.catalogueOff')}</Notice> : null}
          {catState === 'ok' ? <>
            <Field placeholder={t('newPiece.catalogueHint')} value={q} onChangeText={setQ} autoFocus autoCapitalize="none" testID="cat-q" />
            {hits.length ? (
              <YStack borderWidth={1} borderColor={C.line} borderRadius={10} overflow="hidden">
                {hits.map((it) => (
                  <Pressable key={it.i} onPress={() => pick(it)} accessibilityRole="button" testID={'cat-hit-' + it.r}
                    style={({ pressed }) => ({ padding: 10, borderBottomWidth: 1, borderColor: C.line2, backgroundColor: pressed ? C.selected : C.surface })}>
                    <Text fontWeight="600">{it.l || it.d} <Text color={C.muted} fontWeight="400">· {it.b} {it.r}</Text></Text>
                    <Text fontSize={12} color={C.muted}>{[it.o && 'OEM ' + it.o, it.v].filter(Boolean).join(' · ')}</Text>
                  </Pressable>
                ))}
              </YStack>
            ) : null}
            {picked ? <Notice tone="ok">{t('newPiece.linked', { id: picked.i })}</Notice> : null}
          </> : null}
        </Card>
      ) : null}

      <Card>
        <H2>{t('piece.identification')}</H2>
        <XStack gap={12} flexWrap="wrap">
          <Field label={t('pieces.label') + ' *'} value={f.label} onChangeText={set('label')} testID="np-label" />
          <Field label={t('pieces.brand')} value={f.brand} onChangeText={set('brand')} />
        </XStack>
        <XStack gap={12} flexWrap="wrap">
          <Field label={t('pieces.ref') + ' *'} value={f.ref} onChangeText={set('ref')} autoCapitalize="characters" testID="np-ref" />
          <Field label={t('pieces.oem')} hint={t('piece.oemHint')} value={f.oem} onChangeText={set('oem')} autoCapitalize="characters" testID="np-oem" />
          <Field label={t('newPiece.barcode')} value={f.barcode} onChangeText={set('barcode')} keyboardType="number-pad" testID="np-ean" />
        </XStack>
      </Card>

      <Card>
        <H2>{t('piece.prices')}</H2>
        <XStack gap={12} flexWrap="wrap">
          <Field label={'1 · ' + cap(t('pos.level1')) + ' *'} value={f.p1} onChangeText={set('p1')} keyboardType="number-pad" testID="np-price" />
          <Field label={'2 · ' + cap(t('pos.level2'))} hint={t('piece.samePublic')} value={f.p2} onChangeText={set('p2')} keyboardType="number-pad" testID="np-price2" />
          <Field label={'3 · ' + cap(t('pos.level3'))} hint={t('piece.samePublic')} value={f.p3} onChangeText={set('p3')} keyboardType="number-pad" testID="np-price3" />
        </XStack>
      </Card>

      <Card>
        <H2>{t('pieces.stock')}</H2>
        <XStack gap={12} flexWrap="wrap">
          <Field label={t('pieces.location')} placeholder="B1-12" value={f.location} onChangeText={set('location')} autoCapitalize="characters" testID="np-loc" />
          <Field label={t('piece.alert')} value={f.alert} onChangeText={set('alert')} keyboardType="number-pad" testID="np-alert" />
          <Field label={t('piece.desired')} value={f.desired} onChangeText={set('desired')} keyboardType="number-pad" />
        </XStack>
        {!editing && auth.cap?.stockMoves ? (
          <XStack gap={12} flexWrap="wrap" alignItems="flex-end">
            <Field label={t('piece.initQty')} hint={t('piece.initQtyHint')} value={f.initQty} onChangeText={set('initQty')} keyboardType="number-pad" testID="np-qty" />
            <Choice value={wh} onChange={setWh} options={whs.map((w) => [w.id, w.label] as [number, string])} />
          </XStack>
        ) : null}
      </Card>

      {msg ? <Notice tone="bad">{msg}</Notice> : null}
      <XStack gap={10} justifyContent="flex-end">
        <Btn label={t('common.cancel')} onPress={() => router.replace((editing ? '/pieces/' + product!.id : '/pieces') as never)} />
        <Btn label={busy ? t('common.loading') : editing ? t('common.save') : t('newPiece.create')} variant="primary" big onPress={save} disabled={busy} testID="np-create" />
      </XStack>
    </YStack>
  );
}
