import '@/i18n';
import { Stack } from 'expo-router';
import { TamaguiProvider } from 'tamagui';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import config from '@/theme/tamagui.config';
import { AppProvider } from '@/state/app';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <TamaguiProvider config={config} defaultTheme="light">
        <AppProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </AppProvider>
      </TamaguiProvider>
    </SafeAreaProvider>
  );
}
