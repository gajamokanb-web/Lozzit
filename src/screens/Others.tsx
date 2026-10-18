import React, { useMemo } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { c, f } from '../theme';
import { ACTIVITY, dayKey, fmt, MEALS, sum, targets, weekDays } from '../domain';
import { useStore } from '../store';
import { card, Screen, Title } from '../ui';
import { EntryRow } from './AddFood';

/** Meals: today's log grouped by meal. */
export function MealsLog() {
  const { state, removeEntry } = useStore();
  const today = dayKey();
  const entries = state.entries.filter((e) => e.day === today);
  return (
    <Screen>
      <Title>Today's log</Title>
      {entries.length === 0 && <Text style={s.empty}>Nothing logged yet. Tap the green button to add your first meal.</Text>}
      {MEALS.map((m) => {
        const list = entries.filter((e) => e.meal === m.key);
        if (!list.length) return null;
        return (
          <View key={m.key} style={s.group}>
            <View style={s.groupHead}>
              <Text style={s.groupName}>{m.label}</Text>
              <Text style={s.groupKcal}>{fmt(sum(list, 'kcal'))} kcal</Text>
            </View>
            <View style={{ gap: 8 }}>
              {list.map((e) => <EntryRow key={e.id} name={e.name} kcal={e.kcal} onRemove={() => removeEntry(e.id)} />)}
            </View>
          </View>
        );
      })}
    </Screen>
  );
}

/** Stats: calories eaten over the current week against the daily budget. */
export function Stats() {
  const { state } = useStore();
  const t = targets(state.profile!);
  const days = useMemo(() => weekDays(), []);
  const totals = days.map((d) => sum(state.entries.filter((e) => e.day === d.key), 'kcal'));
  const logged = totals.filter((x) => x > 0);
  const avg = logged.length ? logged.reduce((a, b) => a + b, 0) / logged.length : 0;
  const max = Math.max(t.kcal, ...totals);
  return (
    <Screen>
      <Title>This week</Title>
      <View style={[s.panel, card]}>
        <View style={s.chart}>
          {days.map((d, i) => {
            const h = (totals[i] / max) * 140;
            const over = totals[i] > t.kcal;
            return (
              <View key={d.key} style={s.col}>
                <View style={s.colTrack}>
                  <View style={{ height: Math.max(h, totals[i] ? 6 : 0), borderRadius: 8, backgroundColor: over ? c.orange : d.isToday ? c.ink : c.lime }} />
                </View>
                <Text style={[s.colL, d.isToday && { color: c.ink }]}>{d.letter}</Text>
              </View>
            );
          })}
        </View>
        <View style={[s.limit, { bottom: 52 + (t.kcal / max) * 140 }]} />
      </View>
      <View style={s.statRow}>
        <View style={[s.stat, card]}><Text style={s.statL}>Daily budget</Text><Text style={s.statV}>{fmt(t.kcal)}</Text></View>
        <View style={[s.stat, card]}><Text style={s.statL}>Average eaten</Text><Text style={s.statV}>{logged.length ? fmt(avg) : '—'}</Text></View>
      </View>
    </Screen>
  );
}

export function Profile() {
  const { state, reset } = useStore();
  const p = state.profile!;
  const t = targets(p);
  const act = ACTIVITY.find((a) => a.v === p.activity)?.label ?? '';
  const confirmReset = () => {
    const go = () => reset();
    if (Platform.OS === 'web') return go();
    Alert.alert('Start over?', 'This deletes your profile and everything you logged on this phone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete and restart', style: 'destructive', onPress: go },
    ]);
  };
  const rows: [string, string][] = [
    ['Age', `${p.age}`],
    ['Height', `${p.heightCm} cm`],
    ['Weight', `${p.weightKg} kg`],
    ['Goal weight', `${p.goalKg} kg`],
    ['Activity', act],
    ['Daily budget', `${fmt(t.kcal)} kcal`],
    ['Macro targets', `${t.protein}P · ${t.carbs}C · ${t.fat}F`],
  ];
  return (
    <Screen>
      <View style={s.pHead}>
        <View style={s.avatarRing}><View style={s.avatar}><Text style={s.avatarLetter}>{p.name.charAt(0).toUpperCase()}</Text></View></View>
        <Text style={s.pName}>{p.name}</Text>
      </View>
      <View style={[s.list, card]}>
        {rows.map(([k, v], i) => (
          <View key={k} style={[s.li, i > 0 && { borderTopWidth: 1, borderTopColor: c.line }]}>
            <Text style={s.liK}>{k}</Text>
            <Text style={s.liV}>{v}</Text>
          </View>
        ))}
      </View>
      <Pressable onPress={confirmReset} style={s.reset} accessibilityRole="button">
        <Text style={s.resetText}>Start over with a new profile</Text>
      </Pressable>
    </Screen>
  );
}

const s = StyleSheet.create({
  empty: { fontFamily: f.regular, fontSize: 15, color: c.muted, marginHorizontal: 20, lineHeight: 22 },
  group: { marginHorizontal: 20, marginBottom: 20 },
  groupHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  groupName: { fontFamily: f.extra, fontSize: 17, color: c.ink },
  groupKcal: { fontFamily: f.bold, fontSize: 14, color: c.limeText },
  panel: { marginHorizontal: 20, borderRadius: 28, padding: 18, height: 230 },
  chart: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', flex: 1 },
  col: { alignItems: 'center', width: 34 },
  colTrack: { height: 140, justifyContent: 'flex-end', width: 22 },
  colL: { fontFamily: f.semi, fontSize: 12, color: c.soft, marginTop: 10 },
  limit: { position: 'absolute', left: 18, right: 18, height: 1, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: c.soft },
  statRow: { flexDirection: 'row', gap: 12, marginHorizontal: 20, marginTop: 12 },
  stat: { flex: 1, borderRadius: 24, padding: 16 },
  statL: { fontFamily: f.semi, fontSize: 13, color: c.muted },
  statV: { fontFamily: f.extra, fontSize: 24, color: c.ink, letterSpacing: -0.6, marginTop: 4 },
  pHead: { alignItems: 'center', gap: 12, marginBottom: 22 },
  avatarRing: { width: 84, height: 84, borderRadius: 42, borderWidth: 3, borderColor: c.lime, padding: 4 },
  avatar: { flex: 1, borderRadius: 40, backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontFamily: f.extra, fontSize: 32, color: c.lime },
  pName: { fontFamily: f.extra, fontSize: 24, color: c.ink, letterSpacing: -0.5 },
  list: { marginHorizontal: 20, borderRadius: 26, paddingHorizontal: 18 },
  li: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 15 },
  liK: { fontFamily: f.medium, fontSize: 14, color: c.muted },
  liV: { fontFamily: f.bold, fontSize: 14, color: c.ink },
  reset: { alignSelf: 'center', marginTop: 24, paddingVertical: 12, paddingHorizontal: 18 },
  resetText: { fontFamily: f.bold, fontSize: 14, color: c.red },
});
