import React from 'react';
import { Image, Platform, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { c, f } from '../theme';

// ── Demo data (hard-coded for now) ──────────────────────────────────────────
const WEEK = [
  { l: 'M', d: '28' }, { l: 'T', d: '29' }, { l: 'W', d: '30' }, { l: 'T', d: '1' },
  { l: 'F', d: '2' }, { l: 'S', d: '3' }, { l: 'S', d: '4' },
];
const MACROS = [
  { name: 'Protein', v: 62, goal: 120 },
  { name: 'Carbs', v: 88, goal: 220 },
  { name: 'Fat', v: 24, goal: 65 },
];
const STEPS_WEEK = [0.55, 0.82, 0.44, 0.96, 0.68, 0.58, 0.74];
const MEALS = [
  { name: 'Breakfast', kcal: 320, img: require('../../assets/breakfast.jpg') },
  { name: 'Lunch', kcal: 440, img: require('../../assets/lunch.jpg') },
  { name: 'Snack', kcal: 180, img: require('../../assets/snack.jpg') },
];
const KCAL_LEFT = 1240;
const KCAL_GOAL = 2000;

// ── Icons (Lucide paths, ISC licence) ───────────────────────────────────────
const P = {
  bell: ['M10.268 21a2 2 0 0 0 3.464 0', 'M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326'],
  steps: ['M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z', 'M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z', 'M16 17h4', 'M4 13h4'],
  drop: ['M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z'],
  home: ['M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'],
  stats: ['M5 21v-6', 'M12 21V3', 'M19 21V9'],
  meals: ['M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2', 'M7 2v20', 'M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7'],
  user: ['M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2', 'M12 7m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0'],
  scan: ['M3 7V5a2 2 0 0 1 2-2h2', 'M17 3h2a2 2 0 0 1 2 2v2', 'M21 17v2a2 2 0 0 1-2 2h-2', 'M7 21H5a2 2 0 0 1-2-2v-2', 'M7 12h10'],
  flame: ['M12 3q1 4 4 6.5t3 5.5a7 7 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4'],
};

function Icon({ d, size = 24, color = c.ink, fill = 'none', sw = 2 }: { d: string[]; size?: number; color?: string; fill?: string; sw?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      {d.map((p, i) => <Path key={i} d={p} />)}
    </Svg>
  );
}

// ── Pieces ───────────────────────────────────────────────────────────────────
function Header() {
  return (
    <View style={s.header}>
      <View style={s.avatarRing}>
        <View style={s.avatar}><Text style={s.avatarLetter}>T</Text></View>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.greet}>Good morning</Text>
        <Text style={s.hello}>Hello, Tega</Text>
      </View>
      <View style={s.bell}>
        <Icon d={P.bell} size={21} />
        <View style={s.redDot} />
      </View>
    </View>
  );
}

function WeekStrip() {
  return (
    <View style={s.week}>
      {WEEK.map((w, i) => (
        <View key={i} style={[s.day, i === 0 && { backgroundColor: c.ink }]}>
          <Text style={[s.dayL, i === 0 && { color: c.lime }]}>{w.l}</Text>
          <Text style={[s.dayN, i === 0 && { color: '#fff' }]}>{w.d}</Text>
        </View>
      ))}
    </View>
  );
}

function Hero() {
  const R = 58, C = 2 * Math.PI * R, pct = (KCAL_GOAL - KCAL_LEFT) / KCAL_GOAL;
  return (
    <View style={s.hero}>
      <View style={s.heroBlob} />
      <View style={{ width: 136, height: 136 }}>
        <Svg width={136} height={136} viewBox="0 0 136 136">
          <Circle cx={68} cy={68} r={R} fill="none" stroke={c.ink} strokeOpacity={0.13} strokeWidth={16} />
          <Circle cx={68} cy={68} r={R} fill="none" stroke={c.ink} strokeWidth={16} strokeLinecap="round"
            strokeDasharray={`${C * pct} ${C}`} transform="rotate(-90 68 68)" />
        </Svg>
        <View style={s.ringCenter}>
          <Text style={s.ringBig}>{KCAL_LEFT.toLocaleString('en-US')}</Text>
          <Text style={s.ringSmall}>kcal left</Text>
        </View>
      </View>
      <View style={{ flex: 1, gap: 15 }}>
        {MACROS.map((m) => (
          <View key={m.name}>
            <View style={s.macroTop}>
              <Text style={s.macroName}>{m.name}</Text>
              <Text style={s.macroVal}>{m.v}<Text style={s.macroGoal}>/{m.goal}g</Text></Text>
            </View>
            <View style={s.track}><View style={[s.fill, { width: `${(m.v / m.goal) * 100}%` }]} /></View>
          </View>
        ))}
      </View>
    </View>
  );
}

function Tiles() {
  return (
    <View style={s.tiles}>
      <View style={s.tile}>
        <View style={s.tileRow}>
          <View style={[s.ico, { backgroundColor: c.orangeTint }]}><Icon d={P.steps} size={18} color={c.orange} sw={2.2} /></View>
          <Text style={s.tileLabel}>Steps</Text>
        </View>
        <Text style={s.big}>6,420</Text>
        <View style={s.bars}>
          {STEPS_WEEK.map((h, i) => (
            <View key={i} style={{ width: 12, height: 28 * h, borderRadius: 5, backgroundColor: i === STEPS_WEEK.length - 1 ? c.orange : c.orangeSoft }} />
          ))}
        </View>
      </View>
      <View style={s.tile}>
        <View style={s.tileRow}>
          <View style={[s.ico, { backgroundColor: c.blueTint }]}><Icon d={P.drop} size={18} color={c.blue} fill={c.blue} sw={0} /></View>
          <Text style={s.tileLabel}>Water</Text>
        </View>
        <Text style={s.big}>1.5<Text style={s.bigUnit}> L</Text></Text>
        <View style={s.drops}>
          {Array.from({ length: 10 }, (_, i) => (
            <Svg key={i} width={11.5} height={15} viewBox="5 2.5 14 19.5">
              <Path d={P.drop[0]} fill={i < 6 ? c.blue : c.blueSoft} />
            </Svg>
          ))}
        </View>
      </View>
    </View>
  );
}

function Meals() {
  return (
    <>
      <View style={s.mealsHead}>
        <Text style={s.h2}>Today's meals</Text>
        <Text style={s.seeAll}>See all</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.mealsRow}>
        {MEALS.map((m) => (
          <View key={m.name} style={s.meal}>
            <Image source={m.img} style={s.mealImg} />
            <Text style={s.mealName}>{m.name}</Text>
            <View style={s.chip}>
              <Icon d={P.flame} size={12} fill={c.ink} sw={0} />
              <Text style={s.chipText}>{m.kcal} kcal</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </>
  );
}

function BottomNav() {
  return (
    <View style={s.navWrap} pointerEvents="box-none">
      <View style={s.nav}>
        <View style={s.tab}>
          <Icon d={P.home} color={c.ink} fill={c.ink} />
          <View style={s.navDot} />
        </View>
        <View style={s.tab}><Icon d={P.stats} color={c.soft} sw={2.2} /></View>
        <View style={{ width: 70 }} />
        <View style={s.tab}><Icon d={P.meals} color={c.soft} /></View>
        <View style={s.tab}><Icon d={P.user} color={c.soft} /></View>
      </View>
      <View style={s.scan}><Icon d={P.scan} size={26} sw={2.3} /></View>
    </View>
  );
}

export function Home() {
  const top = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 44;
  return (
    <View style={s.page}>
      <ScrollView contentContainerStyle={{ paddingTop: top + 8, paddingBottom: 130 }} showsVerticalScrollIndicator={false}>
        <Header />
        <WeekStrip />
        <Hero />
        <Tiles />
        <Meals />
      </ScrollView>
      <BottomNav />
    </View>
  );
}

const card = { backgroundColor: c.card, borderWidth: 1, borderColor: c.line } as const;

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: c.page },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 20, height: 50 },
  avatarRing: { width: 50, height: 50, borderRadius: 25, borderWidth: 2, borderColor: c.lime, padding: 2.5 },
  avatar: { flex: 1, borderRadius: 25, backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontFamily: f.extra, fontSize: 18, color: c.lime },
  greet: { fontFamily: f.medium, fontSize: 13, color: c.muted, marginBottom: 4 },
  hello: { fontFamily: f.extra, fontSize: 22, color: c.ink, letterSpacing: -0.5 },
  bell: { ...card, width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  redDot: { position: 'absolute', top: 11, right: 12, width: 9, height: 9, borderRadius: 5, backgroundColor: c.red, borderWidth: 2, borderColor: '#fff' },

  week: { flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: 16, marginTop: 14 },
  day: { width: 45, height: 64, borderRadius: 22, alignItems: 'center', justifyContent: 'center', gap: 5 },
  dayL: { fontFamily: f.semi, fontSize: 12, color: c.soft },
  dayN: { fontFamily: f.bold, fontSize: 16, color: c.ink },

  hero: { marginHorizontal: 20, marginTop: 14, height: 172, borderRadius: 30, backgroundColor: c.lime, paddingLeft: 18, paddingRight: 20, flexDirection: 'row', alignItems: 'center', gap: 20, overflow: 'hidden' },
  heroBlob: { position: 'absolute', right: -60, top: -80, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(255,255,255,0.16)' },
  ringCenter: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  ringBig: { fontFamily: f.extra, fontSize: 27, color: c.ink, letterSpacing: -1 },
  ringSmall: { fontFamily: f.semi, fontSize: 12, color: c.ink, opacity: 0.72, marginTop: 3 },
  macroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 7 },
  macroName: { fontFamily: f.semi, fontSize: 12.5, color: c.ink, opacity: 0.78 },
  macroVal: { fontFamily: f.extra, fontSize: 12.5, color: c.ink },
  macroGoal: { fontFamily: f.semi, opacity: 0.6 },
  track: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.5)', overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: c.ink },

  tiles: { flexDirection: 'row', gap: 12, marginHorizontal: 20, marginTop: 14 },
  tile: { ...card, flex: 1, height: 136, borderRadius: 26, padding: 14 },
  tileRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  ico: { width: 32, height: 32, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  tileLabel: { fontFamily: f.semi, fontSize: 13, color: c.muted },
  big: { fontFamily: f.extra, fontSize: 23, color: c.ink, letterSpacing: -0.7, lineHeight: 28, marginTop: 10, marginBottom: 9 },
  bigUnit: { fontFamily: f.semi, fontSize: 13, color: c.muted, letterSpacing: 0 },
  bars: { height: 28, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  drops: { height: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  mealsHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 20, marginTop: 22, marginBottom: 12 },
  h2: { fontFamily: f.extra, fontSize: 18, color: c.ink, letterSpacing: -0.4 },
  seeAll: { fontFamily: f.bold, fontSize: 13.5, color: c.limeText },
  mealsRow: { paddingHorizontal: 20, gap: 12 },
  meal: { ...card, width: 128, height: 156, borderRadius: 26, paddingTop: 11, paddingBottom: 13, alignItems: 'center' },
  mealImg: { width: 74, height: 74, borderRadius: 37, borderWidth: 3, borderColor: '#fff' },
  mealName: { fontFamily: f.bold, fontSize: 14, color: c.ink, marginTop: 10, marginBottom: 7 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: c.lime, borderRadius: 20, paddingVertical: 4, paddingLeft: 7, paddingRight: 9 },
  chipText: { fontFamily: f.bold, fontSize: 11.5, color: c.ink },

  navWrap: { position: 'absolute', left: 16, right: 16, bottom: 28 },
  nav: { ...card, height: 64, borderRadius: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 6, elevation: 8, shadowColor: c.ink, shadowOpacity: 0.1, shadowRadius: 15, shadowOffset: { width: 0, height: 8 } },
  tab: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center', gap: 5 },
  navDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: c.lime },
  scan: { position: 'absolute', alignSelf: 'center', top: -22, width: 66, height: 66, borderRadius: 33, backgroundColor: c.lime, borderWidth: 5, borderColor: '#fff', alignItems: 'center', justifyContent: 'center', elevation: 10 },
});
