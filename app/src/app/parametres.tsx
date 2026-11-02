// Paramètres : instance Dolibarr (avec test de connexion), poste, langue, catalogue commun, profil du magasin.
import { useEffect, useState } from 'react';
import { ScrollView, Switch } from 'react-native';
import { router } from 'expo-router';
import { Text, XStack, YStack } from 'tamagui';
import { useTranslation } from 'react-i18next';
import { useApp } from '@/state/app';
import { Dolibarr, isAddress } from '@/lib/dolibarr';
import { LANGUAGES, type Lang } from '@/i18n';
import { Btn, Card, Chip, Field, H1, Notice } from '@/components/ui';
import { C } from '@/theme/colors';

export default function Parametres() {
  const { t } = useTranslation();
  const { device, shop, auth, saveDevice, saveShop } = useApp();
  const [url, setUrl] = useState(device.dolibarrUrl);
  const [name, setName] = useState(device.deviceName);
  const [cat, setCat] = useState(device.catalogueUrl);
  const [test, setTest] = useState<{ ok: boolean; msg: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [restart, setRestart] = useState(false);
  const [saved, setSaved] = useState(false);
  const [ids, setIds] = useState({ warehouseId: String(shop.warehouseId), cashAccountId: String(shop.cashAccountId), bankAccountId: String(shop.bankAccountId), counterCustomerId: String(shop.counterCustomerId), openingFloat: String(shop.openingFloat) });

  useEffect(() => { setUrl(device.dolibarrUrl); setName(device.deviceName); setCat(device.catalogueUrl); }, [device.dolibarrUrl, device.deviceName, device.catalogueUrl]);

  const runTest = async () => {
    if (!isAddress(url)) { setTest({ ok: false, msg: t('settings.badUrl') }); return; }
    setTesting(true); setTest(null);
    const r = await new Dolibarr(url).ping();
    setTest({ ok: r.ok, msg: r.message }); setTesting(false);
  };

  const save = async () => {
    if (url.trim() && !isAddress(url)) { setTest({ ok: false, msg: t('settings.badUrl') }); return; }
    await saveDevice({ dolibarrUrl: url.trim(), deviceName: name.trim() || 'Comptoir 1', catalogueUrl: cat.trim() });
    const n = (v: string, d: number) => { const x = parseInt(v.replace(/\D/g, ''), 10); return Number.isFinite(x) ? x : d; };
    await saveShop({ warehouseId: n(ids.warehouseId, 1), cashAccountId: n(ids.cashAccountId, 1), bankAccountId: n(ids.bankAccountId, 2), counterCustomerId: n(ids.counterCustomerId, 5), openingFloat: n(ids.openingFloat, 10000) });
    setSaved(true); setTimeout(() => setSaved(false), 2500);
  };

  const pickLang = async (code: Lang) => { const r = await saveDevice({ lang: code }); setRestart(r.needsRestart); };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 20, gap: 16, maxWidth: 820, width: '100%', alignSelf: 'center' }}>
      <XStack alignItems="center" gap={12}>
        {auth.token ? <Btn label={'‹ ' + t('common.back')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} /> : null}
        <H1>{t('settings.title')}</H1>
      </XStack>

      <Card>
        <Text fontSize={17} fontWeight="700">{t('settings.deviceSection')}</Text>
        <Text fontSize={13} color={C.muted}>{t('settings.deviceHint')}</Text>
        <XStack gap={8} alignItems="flex-end" flexWrap="wrap">
          <Field label={t('settings.dolibarrUrl')} hint={t('settings.dolibarrUrlHint')} value={url} onChangeText={(v) => { setUrl(v); setTest(null); }} autoCapitalize="none" autoCorrect={false} keyboardType="url" testID="set-url" />
        </XStack>
        <XStack gap={8} alignItems="center" flexWrap="wrap">
          <Btn label={testing ? t('settings.testing') : t('settings.test')} variant="outline" onPress={runTest} disabled={testing || !url.trim()} testID="set-test" />
          {test ? <Text color={test.ok ? C.ok : C.bad} fontWeight="600" testID="set-test-result">{test.ok ? '✓ ' : '✕ '}{test.msg}</Text> : null}
        </XStack>
        <Field label={t('settings.deviceName')} hint={t('settings.deviceNameHint')} value={name} onChangeText={setName} />
        <YStack gap={6}>
          <Text fontSize={13} fontWeight="600" color="#3D414C">{t('settings.language')}</Text>
          <XStack gap={8} flexWrap="wrap">
            {LANGUAGES.map((l) => <Chip key={l.code} label={l.label} active={device.lang === l.code} onPress={() => pickLang(l.code)} testID={'lang-' + l.code} />)}
          </XStack>
          {restart ? <Notice tone="warn">{t('settings.restartNeeded')}</Notice> : null}
        </YStack>
        <Field label={t('settings.catalogueUrl')} hint={t('settings.catalogueUrlHint')} value={cat} onChangeText={setCat} autoCapitalize="none" autoCorrect={false} />
      </Card>

      <Card>
        <Text fontSize={17} fontWeight="700">{t('settings.shopSection')}</Text>
        <Text fontSize={13} color={C.muted}>{t('settings.shopHint')}</Text>
        <XStack alignItems="center" gap={10}>
          <Switch value={shop.vat} onValueChange={(v) => saveShop({ vat: v })} />
          <Text>{t('settings.vat')}</Text>
        </XStack>
        <YStack gap={6}>
          <Text fontSize={13} fontWeight="600" color="#3D414C">{t('settings.stockMode')}</Text>
          <XStack gap={8} flexWrap="wrap">
            <Chip label={t('settings.stockBill')} active={shop.stockMode === 'bill'} onPress={() => saveShop({ stockMode: 'bill' })} />
            <Chip label={t('settings.stockShipment')} active={shop.stockMode === 'shipment'} onPress={() => saveShop({ stockMode: 'shipment' })} />
          </XStack>
        </YStack>
        <XStack gap={12} flexWrap="wrap">
          <Field label={t('settings.warehouse')} value={ids.warehouseId} onChangeText={(v) => setIds({ ...ids, warehouseId: v })} keyboardType="number-pad" />
          <Field label={t('settings.counterCustomer')} value={ids.counterCustomerId} onChangeText={(v) => setIds({ ...ids, counterCustomerId: v })} keyboardType="number-pad" />
        </XStack>
        <XStack gap={12} flexWrap="wrap">
          <Field label={t('settings.cashAccount')} value={ids.cashAccountId} onChangeText={(v) => setIds({ ...ids, cashAccountId: v })} keyboardType="number-pad" />
          <Field label={t('settings.bankAccount')} value={ids.bankAccountId} onChangeText={(v) => setIds({ ...ids, bankAccountId: v })} keyboardType="number-pad" />
          <Field label={t('settings.openingFloat')} value={ids.openingFloat} onChangeText={(v) => setIds({ ...ids, openingFloat: v })} keyboardType="number-pad" />
        </XStack>
      </Card>

      <XStack gap={10} alignItems="center" flexWrap="wrap">
        <Btn label={t('common.save')} variant="primary" big onPress={save} testID="set-save" />
        {!auth.token && device.dolibarrUrl ? <Btn label={t('settings.continue')} big onPress={() => router.replace('/connexion')} testID="set-continue" /> : null}
        {saved ? <Text color={C.ok} fontWeight="600">{t('settings.saved')}</Text> : null}
      </XStack>
    </ScrollView>
  );
}
