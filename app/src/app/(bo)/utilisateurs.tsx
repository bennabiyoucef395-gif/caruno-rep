// Utilisateurs Dolibarr du magasin et leur groupe (rôle). Lecture : la création de comptes reste dans Dolibarr.
import { Text } from 'tamagui';
import { useTranslation } from 'react-i18next';
import { useApp } from '@/state/app';
import { useLoad, dateFr } from '@/lib/useLoad';
import { Badge, Notice, PageHead, Screen, Table } from '@/components/ui';
import { C } from '@/theme/colors';

export default function Utilisateurs() {
  const { t } = useTranslation();
  const { api, auth } = useApp();
  const { data, error, loading } = useLoad(() => api.users(), [api]);
  return (
    <Screen testID="users-screen">
      <PageHead title={t('users.title')} sub={t('users.sub')} />
      <Notice tone="info">{t('users.hint')}</Notice>
      {error ? <Notice tone="bad">{error}</Notice> : null}
      <Table rows={data || []} keyOf={(u) => u.id} minWidth={680} empty={loading ? t('common.loading') : '—'}
        cols={[
          { key: 'n', label: t('users.name'), flex: 2, render: (u) => <Text fontWeight="700">{u.name}</Text> },
          { key: 'l', label: t('login.login'), flex: 1, render: (u) => u.login },
          { key: 'g', label: t('users.role'), flex: 1, render: (u) => (u.admin ? t('users.admin') : u.groups.join(', ') || '—') },
          { key: 'e', label: t('clients.email'), flex: 1, render: (u) => <Text color={C.muted}>{u.email || '—'}</Text> },
          { key: 's', label: t('users.state'), width: 150, render: (u) => (u.id === auth.me?.id ? <Badge label={t('users.you')} tone="accent" /> : <Badge label={u.active ? t('users.active') : t('users.disabled')} tone={u.active ? 'ok' : 'grey'} />) },
        ]} />
      <Text fontSize={12} color={C.muted}>{t('users.updated', { d: dateFr(Date.now() / 1000, true) })}</Text>
    </Screen>
  );
}
