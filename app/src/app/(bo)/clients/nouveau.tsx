// Création ou modification (?id=) d'un client. La catégorie fixe le niveau de prix Dolibarr (1 Public, 2 Garage, 3 Gros).
import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { XStack } from 'tamagui';
import { useTranslation } from 'react-i18next';
import { useApp } from '@/state/app';
import { explain } from '@/lib/useLoad';
import { Btn, Card, Choice, Field, H2, Notice, PageHead, Screen } from '@/components/ui';

const EMPTY = { name: '', phone: '', email: '', town: '', address: '', rc: '', nif: '', ai: '', nis: '', discount: '', limit: '' };

export default function ClientForm() {
  const { t } = useTranslation();
  const { api, auth } = useApp();
  const idParam = useLocalSearchParams<{ id?: string }>().id;
  const id = idParam ? Number(idParam) : null;
  const [f, setF] = useState(EMPTY);
  const [level, setLevel] = useState(2);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof EMPTY) => (v: string) => setF((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    if (!id) return;
    api.customer(id).then((c) => {
      setF({ name: c.name, phone: c.phone, email: c.email, town: c.town, address: c.address, rc: c.rc, nif: c.nif, ai: c.ai, nis: c.nis, discount: c.discount ? String(c.discount) : '', limit: c.outstandingLimit ? String(c.outstandingLimit) : '' });
      setLevel(c.priceLevel);
    }).catch((e) => setMsg(explain(e)));
  }, [api, id]);

  if (!auth.cap?.editCustomers) return <Screen><Notice tone="warn">{t('clients.notAllowed')}</Notice></Screen>;
  const pro = level > 1;
  const num = (v: string) => parseInt(v.replace(/\D/g, ''), 10) || 0;

  const save = async () => {
    if (!f.name.trim()) { setMsg(t('clients.nameRequired')); return; }
    setBusy(true); setMsg('');
    try {
      const newId = await api.saveCustomer(id, { name: f.name.trim(), phone: f.phone.trim(), email: f.email.trim(), town: f.town.trim(), address: f.address.trim(), priceLevel: level, outstandingLimit: num(f.limit), discount: num(f.discount), rc: f.rc.trim(), nif: f.nif.trim(), ai: f.ai.trim(), nis: f.nis.trim() });
      router.replace(('/clients/' + newId) as never);
    } catch (e) { setMsg(explain(e)); setBusy(false); }
  };

  return (
    <Screen testID="client-form">
      <PageHead title={id ? t('clients.editTitle') : t('clients.new')} back={{ label: t('clients.title'), onPress: () => router.replace((id ? '/clients/' + id : '/clients') as never) }} />
      <Card>
        <H2>{t('clients.category')}</H2>
        <Choice value={level} onChange={setLevel} options={[1, 2, 3].map((l) => [l, t('clients.cat' + l) + ' · ' + t('pos.levelLabel', { name: t('pos.level' + l) })] as [number, string])} testID="cf-level" />
      </Card>
      <Card>
        <H2>{t('clients.contact')}</H2>
        <XStack gap={12} flexWrap="wrap">
          <Field label={(pro ? t('clients.company') : t('clients.fullName')) + ' *'} value={f.name} onChangeText={set('name')} testID="cf-name" />
          <Field label={t('clients.phone')} value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" testID="cf-phone" />
        </XStack>
        <XStack gap={12} flexWrap="wrap">
          <Field label={t('clients.email')} value={f.email} onChangeText={set('email')} autoCapitalize="none" keyboardType="email-address" />
          <Field label={t('clients.town')} value={f.town} onChangeText={set('town')} testID="cf-town" />
        </XStack>
        <Field label={t('clients.address')} value={f.address} onChangeText={set('address')} />
      </Card>
      {pro ? (
        <Card>
          <H2>{t('clients.legal')}</H2>
          <XStack gap={12} flexWrap="wrap">
            <Field label="RC" value={f.rc} onChangeText={set('rc')} autoCapitalize="characters" />
            <Field label="NIF" value={f.nif} onChangeText={set('nif')} />
            <Field label={t('clients.ai')} value={f.ai} onChangeText={set('ai')} />
            <Field label="NIS" value={f.nis} onChangeText={set('nis')} />
          </XStack>
          <H2>{t('clients.terms')}</H2>
          <XStack gap={12} flexWrap="wrap">
            <Field label={t('clients.discount')} value={f.discount} onChangeText={set('discount')} keyboardType="number-pad" />
            <Field label={t('clients.limitDa')} hint={t('clients.limitHint')} value={f.limit} onChangeText={set('limit')} keyboardType="number-pad" testID="cf-limit" />
          </XStack>
        </Card>
      ) : null}
      {msg ? <Notice tone="bad">{msg}</Notice> : null}
      <XStack gap={10} justifyContent="flex-end">
        <Btn label={t('common.cancel')} onPress={() => router.replace((id ? '/clients/' + id : '/clients') as never)} />
        <Btn label={busy ? t('common.loading') : id ? t('common.save') : t('clients.create')} variant="primary" big onPress={save} disabled={busy} testID="cf-save" />
      </XStack>
    </Screen>
  );
}
