// Création d'une pièce dans Dolibarr, en partant d'une fiche du catalogue commun CARUNO (suggestions).
import { useEffect, useState } from 'react';
import { Pressable, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Text, XStack, YStack } from 'tamagui';
import { useTranslation } from 'react-i18next';
import { useApp } from '@/state/app';
import { loadCatalogue, suggest, type CatalogueItem } from '@/lib/catalogue';
import { Btn, Card, Field, H1, Notice } from '@/components/ui';
import { C } from '@/theme/colors';

export default function NouvellePiece() {
  const { t } = useTranslation();
  const { api, auth, device } = useApp();
  const [catState, setCatState] = useState<'loading' | 'ok' | 'off'>('loading');
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<CatalogueItem[]>([]);
  const [picked, setPicked] = useState<CatalogueItem | null>(null);
  const [f, setF] = useState({ ref: '', label: '', brand: '', oem: '', barcode: '', price: '' });
  const [msg, setMsg] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { loadCatalogue(device.catalogueUrl).then(() => setCatState('ok')).catch(() => setCatState('off')); }, [device.catalogueUrl]);
  useEffect(() => { setHits(catState === 'ok' ? suggest(q) : []); }, [q, catState]);

  if (!auth.cap?.createProduct) return <YStack padding={22}><Notice tone="warn">{t('pieces.notAllowed')}</Notice></YStack>;

  const pick = (it: CatalogueItem) => {
    setPicked(it); setHits([]); setQ('');
    setF({ ...f, ref: it.r, label: it.l || it.d, brand: it.b, oem: it.o });
  };

  const create = async () => {
    const price = parseInt(f.price.replace(/\D/g, ''), 10);
    if (!f.ref.trim() || !f.label.trim() || !price) { setMsg({ tone: 'bad', text: t('newPiece.required') }); return; }
    setBusy(true); setMsg(null);
    try {
      await api.createProduct({ ref: f.ref.trim(), label: f.label.trim(), brand: f.brand.trim(), oem: f.oem.trim(), barcode: f.barcode.trim(), price, refExt: picked?.i });
      setMsg({ tone: 'ok', text: t('newPiece.created', { ref: f.ref.trim() }) });
      setF({ ref: '', label: '', brand: '', oem: '', barcode: '', price: '' }); setPicked(null);
    } catch (e) { setMsg({ tone: 'bad', text: (e as Error).message }); }
    finally { setBusy(false); }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 22, gap: 16, maxWidth: 900 }}>
      <XStack gap={12} alignItems="center"><Btn label={'‹ ' + t('pieces.title')} onPress={() => router.replace('/pieces')} /><H1>{t('newPiece.title')}</H1></XStack>

      <Card>
        <Text fontSize={17} fontWeight="700">{t('newPiece.fromCatalogue')}</Text>
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

      <Card>
        <XStack gap={12} flexWrap="wrap">
          <Field label={t('pieces.ref') + ' *'} value={f.ref} onChangeText={(v) => setF({ ...f, ref: v })} autoCapitalize="characters" testID="np-ref" />
          <Field label={t('pieces.brand')} value={f.brand} onChangeText={(v) => setF({ ...f, brand: v })} />
        </XStack>
        <Field label={t('pieces.label') + ' *'} value={f.label} onChangeText={(v) => setF({ ...f, label: v })} testID="np-label" />
        <XStack gap={12} flexWrap="wrap">
          <Field label={t('pieces.oem')} value={f.oem} onChangeText={(v) => setF({ ...f, oem: v })} autoCapitalize="characters" />
          <Field label={t('newPiece.barcode')} value={f.barcode} onChangeText={(v) => setF({ ...f, barcode: v })} keyboardType="number-pad" />
          <Field label={t('newPiece.price') + ' *'} value={f.price} onChangeText={(v) => setF({ ...f, price: v })} keyboardType="number-pad" testID="np-price" />
        </XStack>
        {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
        <XStack><Btn label={busy ? t('common.loading') : t('newPiece.create')} variant="primary" big onPress={create} disabled={busy} testID="np-create" /></XStack>
      </Card>
    </ScrollView>
  );
}
