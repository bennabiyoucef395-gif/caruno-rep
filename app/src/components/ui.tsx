// Briques d'interface communes. Mise en page et textes via Tamagui ; boutons et champs en composants
// React Native de base, dont on contrôle précisément le focus (la caisse se pilote au clavier).
import React, { forwardRef } from 'react';
import { Pressable, ScrollView, TextInput, type TextInputProps, type PressableProps } from 'react-native';
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

// ---------- Écrans du back-office : en-tête, onglets, tableaux, indicateurs (reprise de la maquette).

export function PageHead({ title, sub, actions, back }: { title: React.ReactNode; sub?: React.ReactNode; actions?: React.ReactNode; back?: { label: string; onPress: () => void } }) {
  return (
    <YStack gap={6}>
      {back ? <Pressable accessibilityRole="link" onPress={back.onPress} testID="page-back" style={{ alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center' }}><Text color={C.accent} fontWeight="600" fontSize={14}>‹ {back.label}</Text></Pressable> : null}
      <XStack justifyContent="space-between" alignItems="flex-end" flexWrap="wrap" gap={12}>
        <YStack gap={4} flexShrink={1} minWidth={220}>
          {typeof title === 'string' ? <H1>{title}</H1> : title}
          {sub ? (typeof sub === 'string' ? <Text color={C.muted} fontSize={14}>{sub}</Text> : sub) : null}
        </YStack>
        {actions ? <XStack gap={8} flexWrap="wrap">{actions}</XStack> : null}
      </XStack>
    </YStack>
  );
}

export function Tabs<K extends string>({ tabs, value, onChange }: { tabs: [K, string][]; value: K; onChange: (k: K) => void }) {
  return (
    <XStack gap={4} borderBottomWidth={1} borderColor={C.line} flexWrap="wrap">
      {tabs.map(([k, label]) => (
        <Pressable key={k} accessibilityRole="tab" accessibilityState={{ selected: k === value }} onPress={() => onChange(k)} testID={'tab-' + k}
          style={{ minHeight: 44, paddingHorizontal: 14, justifyContent: 'center', borderBottomWidth: 3, borderColor: k === value ? C.accent : 'transparent', marginBottom: -1 }}>
          <Text fontWeight={k === value ? '700' : '500'} color={k === value ? C.ink : C.muted}>{label}</Text>
        </Pressable>
      ))}
    </XStack>
  );
}

export function Badge({ label, tone = 'grey' }: { label: string; tone?: 'grey' | 'ok' | 'warn' | 'bad' | 'info' | 'accent' }) {
  const map = { grey: ['#ECECE8', '#3D414C'], ok: [C.okBg, C.ok], warn: [C.warnBg, C.warn], bad: [C.badBg, C.bad], info: [C.infoBg, C.info], accent: [C.accentWeak, C.accentInk] } as const;
  return <XStack alignSelf="flex-start" backgroundColor={map[tone][0]} borderRadius={999} paddingHorizontal={10} paddingVertical={3}><Text fontSize={12} fontWeight="600" color={map[tone][1]}>{label}</Text></XStack>;
}

export function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card flexGrow={1} flexBasis={220} minWidth={200} gap={4}>
      <Text fontSize={13} color={C.muted} fontWeight="600">{label}</Text>
      <Text fontSize={26} fontWeight="700">{value}</Text>
      {sub ? <Text fontSize={13} color={C.muted}>{sub}</Text> : null}
    </Card>
  );
}

// Tableau simple : colonnes à largeur fixe ou souple, ligne cliquable, défilement horizontal sur petit écran.
export type Col<T> = { key: string; label: string; width?: number; flex?: number; align?: 'left' | 'right'; render: (row: T) => React.ReactNode };
export function Table<T>({ cols, rows, keyOf, onPress, empty, minWidth = 640, testID }: { cols: Col<T>[]; rows: T[]; keyOf: (r: T) => string | number; onPress?: (r: T) => void; empty?: string; minWidth?: number; testID?: string }) {
  const cell = (c: Col<T>, child: React.ReactNode, head = false) => (
    <YStack key={c.key} width={c.width} flex={c.width ? undefined : c.flex ?? 1} minWidth={0} alignItems={c.align === 'right' ? 'flex-end' : 'flex-start'} paddingHorizontal={8}>
      {typeof child === 'string' || typeof child === 'number' ? <Text fontSize={head ? 12 : 14} fontWeight={head ? '700' : '400'} color={head ? C.muted : C.ink} numberOfLines={head ? 1 : 2} textAlign={c.align === 'right' ? 'right' : 'left'}>{child}</Text> : child}
    </YStack>
  );
  return (
    <Card padded={false} overflow="hidden" gap={0} testID={testID}>
      <ScrollView horizontal contentContainerStyle={{ flexGrow: 1 }}>
        <YStack flexGrow={1} minWidth={minWidth}>
          <XStack paddingHorizontal={8} paddingVertical={10} backgroundColor={C.soft} borderBottomWidth={1} borderColor={C.line}>{cols.map((c) => cell(c, c.label.toUpperCase(), true))}</XStack>
          {rows.length ? rows.map((r) => {
            const inner = <XStack paddingHorizontal={8} paddingVertical={10} alignItems="center" borderBottomWidth={1} borderColor={C.line2}>{cols.map((c) => cell(c, c.render(r)))}</XStack>;
            return onPress
              ? <Pressable key={keyOf(r)} accessibilityRole="link" onPress={() => onPress(r)} style={(s) => ({ backgroundColor: s.pressed || (s as { hovered?: boolean }).hovered ? C.selected : C.surface })}>{inner}</Pressable>
              : <React.Fragment key={keyOf(r)}>{inner}</React.Fragment>;
          }) : <Text padding={24} color={C.muted} textAlign="center">{empty || '—'}</Text>}
        </YStack>
      </ScrollView>
    </Card>
  );
}

export function Pager({ page, total, limit, onPage, label }: { page: number; total: number; limit: number; onPage: (p: number) => void; label: (p: number, n: number) => string }) {
  const pages = Math.ceil(total / limit);
  if (pages <= 1) return null;
  return (
    <XStack justifyContent="center" alignItems="center" gap={12}>
      <Btn label="‹" onPress={() => onPage(page - 1)} disabled={page <= 0} testID="pager-prev" />
      <Text color={C.muted}>{label(page + 1, pages)}</Text>
      <Btn label="›" onPress={() => onPage(page + 1)} disabled={page + 1 >= pages} testID="pager-next" />
    </XStack>
  );
}

// Ligne « libellé : valeur » des fiches.
export function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <XStack justifyContent="space-between" gap={12} paddingVertical={6} borderBottomWidth={1} borderColor={C.line2}>
      <Text color={C.muted} fontSize={14}>{k}</Text>
      {typeof v === 'string' || typeof v === 'number' ? <Text fontSize={14} fontWeight="600" textAlign="right" flexShrink={1}>{v}</Text> : v}
    </XStack>
  );
}

export function H2({ children }: { children: React.ReactNode }) {
  return <Text fontSize={17} fontWeight="700" color={C.ink}>{children}</Text>;
}

// Défilement vertical standard d'un écran du back-office.
export function Screen({ children, testID }: { children: React.ReactNode; testID?: string }) {
  return <ScrollView testID={testID} style={{ flex: 1 }} contentContainerStyle={{ padding: 22, gap: 16, paddingBottom: 60 }}>{children}</ScrollView>;
}

// Choix dans une courte liste (remplace un <select>).
export function Choice<V extends string | number>({ label, value, options, onChange, testID }: { label?: string; value: V; options: [V, string][]; onChange: (v: V) => void; testID?: string }) {
  return (
    <YStack gap={6}>
      {label ? <Text fontSize={13} fontWeight="600" color="#3D414C">{label}</Text> : null}
      <XStack gap={6} flexWrap="wrap">{options.map(([v, l]) => <Chip key={String(v)} label={l} active={v === value} onPress={() => onChange(v)} testID={testID ? testID + '-' + v : undefined} />)}</XStack>
    </YStack>
  );
}
