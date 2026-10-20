import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { c, f } from './theme';

export const P = {
  bell: ['M10.268 21a2 2 0 0 0 3.464 0', 'M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326'],
  steps: ['M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z', 'M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z', 'M16 17h4', 'M4 13h4'],
  drop: ['M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z'],
  home: ['M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'],
  stats: ['M5 21v-6', 'M12 21V3', 'M19 21V9'],
  meals: ['M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2', 'M7 2v20', 'M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7'],
  user: ['M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2', 'M12 7m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0'],
  scan: ['M3 7V5a2 2 0 0 1 2-2h2', 'M17 3h2a2 2 0 0 1 2 2v2', 'M21 17v2a2 2 0 0 1-2 2h-2', 'M7 21H5a2 2 0 0 1-2-2v-2', 'M7 12h10'],
  flame: ['M12 3q1 4 4 6.5t3 5.5a7 7 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4'],
  x: ['M18 6 6 18', 'm6 6 12 12'],
  plus: ['M5 12h14', 'M12 5v14'],
  back: ['m15 18-6-6 6-6'],
  next: ['m9 18 6-6-6-6'],
  chevDown: ['m6 9 6 6 6-6'],
  chevUp: ['m18 15-6-6-6 6'],
  minus: ['M5 12h14'],
  weight: ['M12 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6z', 'M6.5 8a2 2 0 0 0-1.905 1.46L2.1 18.5A2 2 0 0 0 4 21h16a2 2 0 0 0 1.925-2.54L19.4 9.5A2 2 0 0 0 17.48 8Z'],
};

export function Icon({ d, size = 24, color = c.ink, fill = 'none', sw = 2 }: { d: string[]; size?: number; color?: string; fill?: string; sw?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      {d.map((p, i) => <Path key={i} d={p} />)}
    </Svg>
  );
}

export const card = { backgroundColor: c.card, borderWidth: 1, borderColor: c.line } as const;

export type Tab = 'home' | 'stats' | 'meals' | 'profile';

/** Scrolling page that leaves room for the status bar and the floating nav. */
export function Screen({ children }: { children: React.ReactNode }) {
  const { top } = useSafeAreaInsets();
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: top + 12, paddingBottom: 170 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

export function Title({ children }: { children: string }) {
  return <Text style={s.title}>{children}</Text>;
}

const LABELS: Record<Tab, string> = { home: 'Dashboard', stats: 'Stats', meals: 'Logs', profile: 'Profile' };

export function BottomNav({ tab, onTab, onAdd }: { tab: Tab; onTab: (t: Tab) => void; onAdd: () => void }) {
  const { bottom } = useSafeAreaInsets();
  const Item = ({ t, d, fill }: { t: Tab; d: string[]; fill?: boolean }) => {
    const on = tab === t;
    return (
      <Pressable style={s.tab} onPress={() => onTab(t)} hitSlop={4} accessibilityRole="button" accessibilityLabel={LABELS[t]}>
        <Icon d={d} size={22} color={on ? c.ink : c.soft} fill={fill && on ? c.ink : 'none'} />
        <Text style={[s.tabLabel, on && { color: c.ink, fontFamily: f.bold }]}>{LABELS[t]}</Text>
      </Pressable>
    );
  };
  return (
    <View style={[s.navWrap, { bottom: Math.max(bottom, 12) + 10 }]} pointerEvents="box-none">
      <View style={s.nav}>
        <Item t="home" d={P.home} fill />
        <Item t="stats" d={P.stats} />
        <View style={{ width: 64 }} />
        <Item t="meals" d={P.meals} />
        <Item t="profile" d={P.user} />
      </View>
      <Pressable style={s.scan} onPress={onAdd} accessibilityRole="button" accessibilityLabel="Add">
        <Icon d={P.plus} size={30} sw={2.6} />
      </Pressable>
    </View>
  );
}

export const s = StyleSheet.create({
  title: { fontFamily: f.extra, fontSize: 26, color: c.ink, letterSpacing: -0.6, marginHorizontal: 20, marginBottom: 14 },
  navWrap: { position: 'absolute', left: 16, right: 16 },
  nav: { ...card, height: 72, borderRadius: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 4, elevation: 8, shadowColor: c.ink, shadowOpacity: 0.1, shadowRadius: 15, shadowOffset: { width: 0, height: 8 } },
  tab: { width: 68, height: 56, alignItems: 'center', justifyContent: 'center', gap: 4 },
  tabLabel: { fontFamily: f.semi, fontSize: 10.5, color: c.soft },
  scan: { position: 'absolute', alignSelf: 'center', top: -24, width: 66, height: 66, borderRadius: 33, backgroundColor: c.lime, borderWidth: 5, borderColor: '#fff', alignItems: 'center', justifyContent: 'center', elevation: 10 },
});
