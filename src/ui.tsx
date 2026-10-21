import React, { useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from './i18n';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { c, f, onTheme } from './theme';
import type { MealKey } from './domain';

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
  calendar: ['M8 2v4', 'M16 2v4', 'M3 10h18', 'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z'],
  list: ['M8 6h13', 'M8 12h13', 'M8 18h13', 'M3 6h.01', 'M3 12h.01', 'M3 18h.01'],
  search: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z', 'm21 21-4.3-4.3'],
  x: ['M18 6 6 18', 'm6 6 12 12'],
  plus: ['M5 12h14', 'M12 5v14'],
  back: ['m15 18-6-6 6-6'],
  next: ['m9 18 6-6-6-6'],
  chevDown: ['m6 9 6 6 6-6'],
  chevUp: ['m18 15-6-6-6 6'],
  minus: ['M5 12h14'],
  coffee: ['M10 2v2', 'M14 2v2', 'M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1', 'M6 2v2'],
  apple: ['M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.22A4.91 4.91 0 0 0 17 5c-2.22 0-4 1.44-5 2-1-.56-2.78-2-5-2a4.9 4.9 0 0 0-5 4.78C2 14 5 22 8 22c1.25 0 2.5-1.06 4-1.06Z', 'M10 2c1 .5 2 2 2 5'],
  cookie: ['M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5', 'M8.5 8.5v.01', 'M16 15.5v.01', 'M12 12v.01', 'M11 17v.01', 'M7 14v.01'],
  moonStar: ['M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9', 'M20 3v4', 'M22 5h-4'],
  popcorn: ['M18 8a2 2 0 0 0 0-4 2 2 0 0 0-4 0 2 2 0 0 0-4 0 2 2 0 0 0-4 0 2 2 0 0 0 0 4', 'M10 22 9 8', 'm14 22 1-14', 'M20 8c.5 0 .9.4.8 1l-2.6 12c-.1.5-.7 1-1.2 1H7c-.6 0-1.1-.4-1.2-1L3.2 9c-.1-.6.3-1 .8-1Z'],
  zap: ['M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z'],
  camera: ['M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z', 'M12 13m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0'],
  book: ['M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20'],
  more: ['M12 5.5v.01', 'M12 12v.01', 'M12 18.5v.01'],
  trash: ['M3 6h18', 'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2', 'M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6', 'M10 11v6', 'M14 11v6'],
  copy: ['M9 9h10a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2z', 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1'],
  factor: ['M6 6l12 12', 'M18 6L6 18', 'M4 12h2', 'M18 12h2'],
  image: ['M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z', 'M8.5 8.5m-1.5 0a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0', 'M21 15l-5-5L5 21'],
  edit: ['M12 20h9', 'M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z'],
  weight: ['M12 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6z', 'M6.5 8a2 2 0 0 0-1.905 1.46L2.1 18.5A2 2 0 0 0 4 21h16a2 2 0 0 0 1.925-2.54L19.4 9.5A2 2 0 0 0 17.48 8Z'],
};

export function Icon({ d, size = 24, color = c.ink, fill = 'none', sw = 2 }: { d: string[]; size?: number; color?: string; fill?: string; sw?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      {d.map((p, i) => <Path key={i} d={p} />)}
    </Svg>
  );
}

/** Round colour badge + glyph used for meals, water and weight. */
export function Disc({ d, bg, size = 44, fill = 'none', sw = 2 }: { d: string[]; bg: string; size?: number; fill?: string; sw?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Icon d={d} size={size * 0.52} color="#fff" fill={fill} sw={sw} />
    </View>
  );
}
export const MEAL_STYLE: Record<MealKey, { d: string[]; bg: string }> = {
  breakfast: { d: P.coffee, bg: '#FF9F43' },
  snack_am: { d: P.apple, bg: '#7DC242' },
  lunch: { d: P.meals, bg: '#22B5A3' },
  snack_pm: { d: P.cookie, bg: '#F2688A' },
  dinner: { d: P.moonStar, bg: '#5B5BD6' },
  snack_eve: { d: P.popcorn, bg: '#9B6BE8' },
};
export const MealIcon = ({ k, size = 44 }: { k: MealKey; size?: number }) => <Disc d={MEAL_STYLE[k].d} bg={MEAL_STYLE[k].bg} size={size} />;

export const card: { backgroundColor: string; borderWidth: number; borderColor: string } = { backgroundColor: c.card, borderWidth: 1, borderColor: c.line };
onTheme(() => { card.backgroundColor = c.card; card.borderColor = c.line; });

export type Tab = 'home' | 'stats' | 'recipes' | 'profile';

/** Scrolling page that leaves room for the status bar and the floating nav. */
/** How far the soft keyboard covers the bottom of the referenced view (0 when the window already resizes). */
export function useKbOverlap() {
  const ref = useRef<View>(null);
  const [pad, setPad] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (e) => {
      ref.current?.measureInWindow((_x, y, _w, h) => setPad(Math.max(0, Math.round(y + h - e.endCoordinates.screenY))));
    });
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setPad(0));
    return () => { show.remove(); hide.remove(); };
  }, []);
  return { ref, pad };
}

/** Container that keeps its content above the keyboard (replacement for KeyboardAvoidingView, which does nothing on Android here). */
export function KbView({ style, children }: { style?: any; children: React.ReactNode }) {
  const { ref, pad } = useKbOverlap();
  const fl = StyleSheet.flatten(style) ?? {};
  const base = Number(fl.paddingBottom ?? fl.padding ?? 0);
  return <View ref={ref} collapsable={false} style={[style, { paddingBottom: base + pad }]}>{children}</View>;
}

export function Screen({ children }: { children: React.ReactNode }) {
  const { top } = useSafeAreaInsets();
  const { ref, pad } = useKbOverlap();
  return (
    <View ref={ref} collapsable={false} style={{ flex: 1, paddingBottom: pad }}>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: top + 12, paddingBottom: pad ? 24 : 170 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
    </View>
  );
}

export function Title({ children }: { children: string }) {
  return <Text style={s.title}>{children}</Text>;
}

const LABELS: Record<Tab, string> = { home: 'Dashboard', stats: 'Stats', recipes: 'Recipes', profile: 'Profile' };

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
        <Item t="recipes" d={P.book} />
        <Item t="profile" d={P.user} />
      </View>
      <Pressable style={s.scan} onPress={onAdd} accessibilityRole="button" accessibilityLabel="Add">
        <Icon d={P.plus} size={30} sw={2.6} />
      </Pressable>
    </View>
  );
}

const mkStyles = () => StyleSheet.create({
  title: { fontFamily: f.extra, fontSize: 26, color: c.ink, letterSpacing: -0.6, marginHorizontal: 10, marginBottom: 14 },
  navWrap: { position: 'absolute', left: 16, right: 16 },
  nav: { ...card, height: 72, borderRadius: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 4, elevation: 8, shadowColor: c.ink, shadowOpacity: 0.1, shadowRadius: 15, shadowOffset: { width: 0, height: 8 } },
  tab: { width: 68, height: 56, alignItems: 'center', justifyContent: 'center', gap: 4 },
  tabLabel: { fontFamily: f.semi, fontSize: 10.5, color: c.soft },
  scan: { position: 'absolute', alignSelf: 'center', top: -24, width: 66, height: 66, borderRadius: 33, backgroundColor: c.lime, borderWidth: 5, borderColor: c.card, alignItems: 'center', justifyContent: 'center', elevation: 10 },
});
export let s = mkStyles();
onTheme(() => { s = mkStyles(); });
