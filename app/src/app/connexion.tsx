// Connexion par utilisateur : identifiant et mot de passe Dolibarr du magasin (POST /login).
import { useRef, useState } from 'react';
import { Redirect, router } from 'expo-router';
import { Text, XStack, YStack } from 'tamagui';
import { useTranslation } from 'react-i18next';
import { useApp } from '@/state/app';
import { Btn, Field, Notice, type InputRef } from '@/components/ui';
import { C } from '@/theme/colors';

export default function Connexion() {
  const { t } = useTranslation();
  const { device, auth, signIn, ready } = useApp();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const pwRef = useRef<InputRef>(null);

  if (ready && auth.token) return <Redirect href="/" />;

  const submit = async () => {
    if (!login || !password) return;
    setBusy(true); setErr('');
    try { await signIn(login.trim(), password); setPassword(''); router.replace('/'); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <YStack flex={1} backgroundColor={C.dark} alignItems="center" justifyContent="center" padding={24}>
      <YStack width="100%" maxWidth={440} gap={20}>
        <YStack gap={4}>
          <Text color="#fff" fontSize={34} fontWeight="700" letterSpacing={3}>{t('app.name')}</Text>
          <Text color="#C9CBD2">{t('app.tagline')}</Text>
          {device.dolibarrUrl ? <Text color="#C9CBD2" fontSize={13}>{t('login.shop')} : {device.dolibarrUrl}</Text> : null}
        </YStack>
        {!device.dolibarrUrl ? <Notice tone="warn">{t('login.noUrl')}</Notice> : null}
        <YStack gap={14} backgroundColor={C.surface} borderRadius={14} padding={18}>
          <Text fontSize={20} fontWeight="700">{t('login.title')}</Text>
          <Field label={t('login.login')} value={login} onChangeText={setLogin} autoCapitalize="none" autoCorrect={false} autoFocus returnKeyType="next" onSubmitEditing={() => pwRef.current?.focus()} testID="login-user" />
          <Field ref={pwRef} label={t('login.password')} value={password} onChangeText={setPassword} secureTextEntry onSubmitEditing={submit} testID="login-pw" />
          {err ? <Notice tone="bad">{err}</Notice> : null}
          <Btn label={busy ? t('common.loading') : t('login.submit')} variant="primary" big onPress={submit} disabled={busy || !login || !password || !device.dolibarrUrl} testID="login-submit" />
          <Text fontSize={13} color={C.muted}>{t('login.hint')}</Text>
        </YStack>
        <XStack justifyContent="center">
          <Btn label={'⚙ ' + t('nav.parametres')} onPress={() => router.push('/parametres')} testID="login-settings" />
        </XStack>
      </YStack>
    </YStack>
  );
}
