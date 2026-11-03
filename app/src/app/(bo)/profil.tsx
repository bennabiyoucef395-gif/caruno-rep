// Mon profil : identité Dolibarr, droits vus par l'app, magasin et poste.
import { router } from 'expo-router';
import { Text, XStack } from 'tamagui';
import { useTranslation } from 'react-i18next';
import { useApp, money } from '@/state/app';
import { Badge, Btn, Card, H2, KV, PageHead, Screen } from '@/components/ui';
import { C } from '@/theme/colors';

export default function Profil() {
  const { t } = useTranslation();
  const { auth, device, shop, signOut } = useApp();
  const cap = auth.cap || ({} as Record<string, boolean>);
  const rights: [string, boolean][] = [
    [t('profil.sell'), !!cap.sell], [t('profil.cost'), !!cap.seeCost], [t('profil.createProduct'), !!cap.createProduct], [t('profil.stockMoves'), !!cap.stockMoves],
    [t('profil.customers'), !!cap.customers], [t('profil.purchases'), !!cap.purchases], [t('profil.bank'), !!cap.bank], [t('profil.users'), !!cap.users],
  ];
  return (
    <Screen testID="profil-screen">
      <PageHead title={t('profil.title')} sub={(auth.me?.name || '') + ' · ' + (auth.me?.login || '')}
        actions={<Btn label={t('nav.logout')} variant="dark" onPress={async () => { await signOut(); router.replace('/connexion'); }} testID="profil-logout" />} />
      <XStack gap={16} flexWrap="wrap" alignItems="flex-start">
        <Card flexGrow={1} flexBasis={320}>
          <H2>{t('profil.rights')}</H2>
          <Text fontSize={13} color={C.muted}>{t('profil.rightsHint')}</Text>
          {rights.map(([k, v]) => <KV key={k} k={k} v={<Badge label={v ? t('common.yes') : t('common.no')} tone={v ? 'ok' : 'grey'} />} />)}
        </Card>
        <Card flexGrow={1} flexBasis={320}>
          <H2>{t('profil.shop')}</H2>
          <KV k={t('settings.dolibarrUrl')} v={device.dolibarrUrl} />
          <KV k={t('settings.deviceName')} v={device.deviceName} />
          <KV k={t('settings.vat')} v={shop.vat ? t('common.yes') : t('common.no')} />
          <KV k={t('settings.openingFloat')} v={money(shop.openingFloat, t('common.da'))} />
          <KV k={t('profil.levels')} v={[1, 2, 3].map((l) => t('pos.level' + l)).join(', ')} />
          <Btn label={'⚙ ' + t('nav.parametres')} onPress={() => router.push('/parametres')} />
        </Card>
      </XStack>
    </Screen>
  );
}
