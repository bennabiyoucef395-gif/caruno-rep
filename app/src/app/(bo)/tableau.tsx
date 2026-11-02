import { ScrollView } from 'react-native';
import { Text } from 'tamagui';
import { useTranslation } from 'react-i18next';
import { Card, H1 } from '@/components/ui';
import { C } from '@/theme/colors';

export default function Tableau() {
  const { t } = useTranslation();
  return (
    <ScrollView contentContainerStyle={{ padding: 22, gap: 16 }}>
      <H1>{t('dash.title')}</H1>
      <Card><Text color={C.muted}>{t('dash.soon')}</Text></Card>
    </ScrollView>
  );
}
