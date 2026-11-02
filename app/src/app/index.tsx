// Aiguillage au démarrage : Paramètres si aucune instance n'est configurée, puis connexion, puis l'écran du rôle.
import { Redirect } from 'expo-router';
import { Text, YStack } from 'tamagui';
import { useTranslation } from 'react-i18next';
import { useApp } from '@/state/app';
import { C } from '@/theme/colors';

export default function Index() {
  const { ready, device, auth } = useApp();
  const { t } = useTranslation();
  if (!ready) return <YStack flex={1} alignItems="center" justifyContent="center" backgroundColor={C.bg}><Text color={C.muted}>{t('common.loading')}</Text></YStack>;
  if (!device.dolibarrUrl) return <Redirect href="/parametres" />;
  if (!auth.token) return <Redirect href="/connexion" />;
  return <Redirect href={auth.cap?.sell ? '/caisse' : '/pieces'} />;
}
