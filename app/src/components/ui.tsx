// Briques d'interface communes. Mise en page et textes via Tamagui ; boutons et champs en composants
// React Native de base, dont on contrôle précisément le focus (la caisse se pilote au clavier).
import React, { forwardRef } from 'react';
import { Pressable, TextInput, type TextInputProps, type PressableProps } from 'react-native';
import { Text, XStack, YStack } from 'tamagui';
import { C } from '@/theme/colors';

// Référence vers un champ de saisie (type d'instance de TextInput en React Native 0.88).
export type InputRef = React.ComponentRef<typeof TextInput>;

type BtnProps = PressableProps & { label: string; variant?: 'primary' | 'dark' | 'outline' | 'plain'; big?: boolean; testID?: string };

export function Btn({ label, variant = 'plain', big, disabled, style, ...rest }: BtnProps) {
  const bg = disabled ? '#E4E4DF' : variant === 'primary' ? C.accent : variant === 'dark' ? C.dark : C.surface;
  const fg = disabled ? C.muted : variant === 'primary' || variant === 'dark' ? '#fff' : C.ink;
  const border = disabled ? '#E4E4DF' : variant === 'primary' ? C.accent : variant === 'dark' ? C.dark : variant === 'outline' ? C.ink : C.line;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={(s) => [{ minHeight: big ? 56 : 44, paddingHorizontal: 16, borderRadius: big ? 12 : 10, borderWidth: 1, borderColor: border, backgroundColor: s.pressed && !disabled ? (variant === 'primary' ? C.accentHover : variant === 'dark' ? '#000' : C.soft) : bg, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }, typeof style === 'function' ? style(s) : style]}
      {...rest}
    >
      <Text color={fg} fontWeight={variant === 'plain' ? '500' : '700'} fontSize={big ? 17 : 14}>{label}</Text>
    </Pressable>
  );
}

type FieldProps = TextInputProps & { label?: string; hint?: string; big?: boolean };

export const Field = forwardRef<InputRef, FieldProps>(function Field({ label, hint, big, style, ...rest }, ref) {
  return (
    <YStack gap={6} flexGrow={1} minWidth={180}>
      {label ? <Text fontSize={13} fontWeight="600" color="#3D414C">{label}</Text> : null}
      <TextInput
        ref={ref}
        placeholderTextColor="#8A8F9C"
        style={[{ minHeight: big ? 52 : 44, borderWidth: 1, borderColor: '#CFD0CA', borderRadius: 10, backgroundColor: C.surface, paddingHorizontal: 12, fontSize: big ? 20 : 15, color: C.ink, fontWeight: big ? '700' : '400' }, style as object]}
        {...rest}
      />
      {hint ? <Text fontSize={12} color={C.muted}>{hint}</Text> : null}
    </YStack>
  );
});

export function Card({ children, padded = true, ...rest }: React.ComponentProps<typeof YStack> & { padded?: boolean }) {
  return (
    <YStack backgroundColor={C.surface} borderWidth={1} borderColor={C.line} borderRadius={14} padding={padded ? 16 : 0} gap={12} {...rest}>
      {children}
    </YStack>
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'ok' | 'warn' | 'bad'; children: React.ReactNode }) {
  const map = { info: [C.infoBg, C.info], ok: [C.okBg, C.ok], warn: [C.warnBg, '#5C2A06'], bad: [C.badBg, C.bad] } as const;
  return (
    <XStack backgroundColor={map[tone][0]} borderRadius={10} paddingHorizontal={14} paddingVertical={10}>
      <Text color={map[tone][1]} fontSize={14} flex={1}>{children}</Text>
    </XStack>
  );
}

export function Chip({ label, sub, active, onPress, testID }: { label: string; sub?: string; active?: boolean; onPress?: () => void; testID?: string }) {
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityState={{ selected: !!active }} onPress={onPress}
      style={{ minHeight: 44, borderRadius: 10, borderWidth: 1, borderColor: active ? C.ink : '#CFD0CA', backgroundColor: active ? C.ink : C.surface, paddingHorizontal: 10, paddingVertical: 4, justifyContent: 'center' }}>
      {sub ? <Text fontSize={11} color={active ? '#D6D7DC' : C.muted}>{sub}</Text> : null}
      <Text fontSize={14} fontWeight="700" color={active ? '#fff' : C.ink}>{label}</Text>
    </Pressable>
  );
}

export function H1({ children }: { children: React.ReactNode }) {
  return <Text fontSize={24} fontWeight="700" color={C.ink}>{children}</Text>;
}
