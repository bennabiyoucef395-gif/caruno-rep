// Back-office : menu latéral repliable (icônes seules), mémorisé sur le poste. La caisse, elle, est plein écran.
import { Pressable, ScrollView, useWindowDimensions } from 'react-native';
import { Redirect, Slot, router, usePathname } from 'expo-router';
import { Text, XStack, YStack } from 'tamagui';
import { useTranslation } from 'react-i18next';
import { useApp } from '@/state/app';
import { C } from '@/theme/colors';

export default function BackOffice() {
  const { t } = useTranslation();
  const { ready, auth, navFolded, setNavFolded, signOut } = useApp();
  const path = usePathname();
  const { width } = useWindowDimensions();
  if (!ready) return null;
  if (!auth.token) return <Redirect href="/connexion" />;
  const folded = navFolded || width < 760;

  // Menu de la maquette, filtré par les droits Dolibarr de l'utilisateur.
  const cap = auth.cap;
  const items = [
    cap?.sell ? { href: '/caisse', icon: '▣', label: t('nav.caisse') } : null,
    { href: '/pieces', icon: '⬡', label: t('nav.pieces') },
    { href: '/catalogue', icon: '☰', label: t('nav.catalogue') },
    cap?.stock ? { href: '/stock', icon: '▤', label: t('nav.stock') } : null,
    cap?.customers ? { href: '/clients', icon: '☺', label: t('nav.clients') } : null,
    cap?.invoices || cap?.orders ? { href: '/ventes', icon: '▧', label: t('nav.ventes') } : null,
    cap?.purchases ? { href: '/achats', icon: '⇩', label: t('nav.achats') } : null,
    cap?.bankRead ? { href: '/reglements', icon: '◈', label: t('nav.reglements') } : null,
    { href: '/scanner', icon: '⌗', label: t('nav.scanner') },
    cap?.invoices ? { href: '/tableau', icon: '▥', label: t('nav.tableau') } : null,
    cap?.users ? { href: '/utilisateurs', icon: '◎', label: t('nav.utilisateurs') } : null,
    { href: '/profil', icon: '●', label: t('nav.profil') },
    { href: '/parametres', icon: '⚙', label: t('nav.parametres') },
  ].filter(Boolean) as { href: string; icon: string; label: string }[];

  return (
    <XStack flex={1} backgroundColor={C.bg}>
      <YStack width={folded ? 72 : 236} backgroundColor={C.dark} paddingVertical={16} paddingHorizontal={folded ? 10 : 12} gap={4}>
        <XStack alignItems="center" justifyContent={folded ? 'center' : 'space-between'} paddingHorizontal={folded ? 0 : 10} paddingBottom={18}>
          {!folded ? <Text color="#fff" fontSize={21} fontWeight="700" letterSpacing={2}>CARUNO</Text> : null}
          {width >= 760 ? (
            <Pressable testID="nav-toggle" accessibilityRole="button" accessibilityLabel={folded ? t('nav.unfold') : t('nav.fold')} onPress={() => setNavFolded(!navFolded)}
              style={{ width: 34, height: 34, borderRadius: 8, borderWidth: 1, borderColor: '#3A3E48', alignItems: 'center', justifyContent: 'center' }}>
              <Text color="#fff" fontSize={16}>{folded ? '›' : '‹'}</Text>
            </Pressable>
          ) : null}
        </XStack>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 4 }}>
        {items.map((it) => {
          const active = path.startsWith(it.href);
          return (
            <Pressable key={it.href} testID={'nav-' + it.href.slice(1)} accessibilityRole="link" accessibilityLabel={it.label} onPress={() => router.push(it.href as never)}
              style={{ minHeight: 44, borderRadius: 9, paddingHorizontal: folded ? 0 : 12, flexDirection: 'row', alignItems: 'center', justifyContent: folded ? 'center' : 'flex-start', gap: 12, backgroundColor: active ? C.accent : 'transparent' }}>
              <Text color="#fff" fontSize={18}>{it.icon}</Text>
              {!folded ? <Text color={active ? '#fff' : C.darkInk} fontWeight={active ? '600' : '400'} fontSize={15}>{it.label}</Text> : null}
            </Pressable>
          );
        })}
        </ScrollView>
        <YStack borderTopWidth={1} borderColor="#33363F" paddingTop={12} gap={8} alignItems={folded ? 'center' : 'flex-start'} paddingHorizontal={folded ? 0 : 10}>
          {!folded ? <Text color="#fff" fontWeight="700" fontSize={14}>{auth.me?.name}</Text> : null}
          <Pressable accessibilityRole="button" onPress={async () => { await signOut(); router.replace('/connexion'); }}>
            <Text color="#C9CBD2" fontSize={13}>{folded ? '⏻' : t('nav.logout')}</Text>
          </Pressable>
        </YStack>
      </YStack>
      <YStack flex={1}><Slot /></YStack>
    </XStack>
  );
}
