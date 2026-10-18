import React, { useMemo } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { c, f } from '../theme';
import { dayKey, fmt, greeting, MEALS, sum, targets, weekDays, type MealKey } from '../domain';
import { useStore } from '../store';
import { card, Icon, P, Screen } from '../ui';

const PHOTOS: Record<MealKey, number> = {
  breakfast: require('../../assets/breakfast.jpg'),
  lunch: require('../../assets/lunch.jpg'),
  dinner: require('../../assets/dinner.jpg'),
  snack: require('../../assets/snack.jpg'),
};
const DROP_L = 0.25; // litres per drop, 10 drops = 2.5 L

function Header({ name, onProfile }: { name: string; onProfile: () => void }) {
  return (
    <View style={s.header}>
      <Pressable onPress={onProfile} style={s.avatarRing} accessibilityLabel="Profile">
        <View style={s.avatar}><Text style={s.avatarLetter}>{name.charAt(0).toUpperCase()}</Text></View>
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={s.greet}>{greeting()}</Text>
        <Text style={s.hello} numberOfLines={1}>Hello, {name}</Text>
      </View>
      <View style={s.bell}>
        <Icon d={P.bell} size={21} />
      </View>
    </View>
  );
}

function WeekStrip({ selected, onSelect }: { selected: string; onSelect: (k: string) => void }) {
  const days = useMemo(() => weekDays(), []);
  return (
    <View style={s.week}>
      {days.map((d) => {
        const on = d.key === selected;
        return (
          <Pressable key={d.key} onPress={() => onSelect(d.key)} style={[s.day, on && { backgroundColor: c.ink }]} accessibilityLabel={`Day ${d.date}`}>
            <Text style={[s.dayL, on && { color: c.lime }]}>{d.letter}</Text>
            <Text style={[s.dayN, on && { color: '#fff' }]}>{d.date}</Text>
            <View style={[s.todayDot, { opacity: d.isToday && !on ? 1 : 0 }]} />
          </Pressable>
        );
      })}
    </View>
  );
}

export function Home({ onAdd, onProfile }: { onAdd: (meal: MealKey, day: string) => void; onProfile: () => void }) {
  const { state, setWater } = useStore();
  const profile = state.profile!;
  const [selected, setSelected] = React.useState(dayKey());
  const t = useMemo(() => targets(profile), [profile]);

  const entries = state.entries.filter((e) => e.day === selected);
  const eaten = sum(entries, 'kcal');
  const left = t.kcal - eaten;
  const pct = Math.min(eaten / t.kcal, 1);
  const R = 58, C = 2 * Math.PI * R;
  const drops = Math.min(10, state.water[selected] ?? 0);
  const litres = Number((drops * DROP_L).toFixed(2));

  const macros = [
    { name: 'Protein', v: sum(entries, 'p'), goal: t.protein },
    { name: 'Carbs', v: sum(entries, 'c'), goal: t.carbs },
    { name: 'Fat', v: sum(entries, 'f'), goal: t.fat },
  ];

  const tapDrop = (i: number) => setWater(selected, drops === i + 1 ? i : i + 1);

  return (
    <Screen>
      <Header name={profile.name} onProfile={onProfile} />
      <WeekStrip selected={selected} onSelect={setSelected} />

      <View style={s.hero}>
        <View style={s.heroBlob} />
        <View style={{ width: 136, height: 136 }}>
          <Svg width={136} height={136} viewBox="0 0 136 136">
            <Circle cx={68} cy={68} r={R} fill="none" stroke={c.ink} strokeOpacity={0.13} strokeWidth={16} />
            {pct > 0 && (
              <Circle cx={68} cy={68} r={R} fill="none" stroke={c.ink} strokeWidth={16} strokeLinecap="round" strokeDasharray={`${C * pct} ${C}`} transform="rotate(-90 68 68)" />
            )}
          </Svg>
          <View style={s.ringCenter}>
            <Text style={s.ringBig}>{fmt(Math.abs(left))}</Text>
            <Text style={s.ringSmall}>{left >= 0 ? 'kcal left' : 'kcal over'}</Text>
          </View>
        </View>
        <View style={{ flex: 1, gap: 15 }}>
          {macros.map((m) => (
            <View key={m.name}>
              <View style={s.macroTop}>
                <Text style={s.macroName}>{m.name}</Text>
                <Text style={s.macroVal}>{Math.round(m.v)}<Text style={s.macroGoal}>/{m.goal}g</Text></Text>
              </View>
              <View style={s.track}><View style={[s.fill, { width: `${Math.min(m.v / m.goal, 1) * 100}%` }]} /></View>
            </View>
          ))}
        </View>
      </View>

      <View style={s.tiles}>
        <View style={s.tile}>
          <View style={s.tileRow}>
            <View style={[s.ico, { backgroundColor: c.orangeTint }]}><Icon d={P.steps} size={18} color={c.orange} sw={2.2} /></View>
            <Text style={s.tileLabel}>Steps</Text>
          </View>
          <Text style={[s.big, { color: c.soft }]}>—</Text>
          <View style={s.bars}>
            {[0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4].map((h, i) => <View key={i} style={{ width: 12, height: 28 * h, borderRadius: 5, backgroundColor: c.orangeTint }} />)}
          </View>
        </View>
        <View style={s.tile}>
          <View style={s.tileRow}>
            <View style={[s.ico, { backgroundColor: c.blueTint }]}><Icon d={P.drop} size={18} color={c.blue} fill={c.blue} sw={0} /></View>
            <Text style={s.tileLabel}>Water</Text>
          </View>
          <Text style={s.big}>{litres}<Text style={s.bigUnit}> L</Text></Text>
          <View style={s.drops}>
            {Array.from({ length: 10 }, (_, i) => (
              <Pressable key={i} onPress={() => tapDrop(i)} hitSlop={{ top: 12, bottom: 12, left: 1, right: 1 }} accessibilityLabel={`Water ${i + 1}`}>
                <Svg width={11.5} height={15} viewBox="5 2.5 14 19.5"><Path d={P.drop[0]} fill={i < drops ? c.blue : c.blueSoft} /></Svg>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      <View style={s.mealsHead}>
        <Text style={s.h2}>Today's meals</Text>
        <Text style={s.seeAll}>{selected === dayKey() ? '' : 'Other day'}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.mealsRow}>
        {MEALS.map((m) => (
          <Pressable key={m.key} style={s.meal} onPress={() => onAdd(m.key, selected)} accessibilityLabel={`Add ${m.label}`}>
            <Image source={PHOTOS[m.key]} style={s.mealImg} />
            <Text style={s.mealName}>{m.label}</Text>
            <View style={s.chip}>
              <Icon d={P.flame} size={12} fill={c.ink} sw={0} />
              <Text style={s.chipText}>{fmt(sum(entries.filter((e) => e.meal === m.key), 'kcal'))} kcal</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 20, height: 50 },
  avatarRing: { width: 50, height: 50, borderRadius: 25, borderWidth: 2, borderColor: c.lime, padding: 2.5 },
  avatar: { flex: 1, borderRadius: 25, backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontFamily: f.extra, fontSize: 18, color: c.lime },
  greet: { fontFamily: f.medium, fontSize: 13, color: c.muted, marginBottom: 4 },
  hello: { fontFamily: f.extra, fontSize: 22, color: c.ink, letterSpacing: -0.5 },
  bell: { ...card, width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },

  week: { flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: 16, marginTop: 14 },
  day: { width: 45, height: 64, borderRadius: 22, alignItems: 'center', justifyContent: 'center', gap: 4 },
  dayL: { fontFamily: f.semi, fontSize: 12, color: c.soft },
  dayN: { fontFamily: f.bold, fontSize: 16, color: c.ink },
  todayDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: c.lime },

  hero: { marginHorizontal: 20, marginTop: 14, height: 172, borderRadius: 30, backgroundColor: c.lime, paddingLeft: 18, paddingRight: 20, flexDirection: 'row', alignItems: 'center', gap: 20, overflow: 'hidden' },
  heroBlob: { position: 'absolute', right: -60, top: -80, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(255,255,255,0.16)' },
  ringCenter: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
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
});
