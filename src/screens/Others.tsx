import React, { useMemo } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { c, f } from '../theme';
import { ACTIVITY, dayKey, fmt, fmtDay, sum, targets, weekDays } from '../domain';
import { useStore } from '../store';
import { card, Screen, Title } from '../ui';
import { enableSteps } from '../steps';

/** Logs: every day with something logged, newest first. Tap a day to open it on the dashboard. */
export function Logs({ onPickDay }: { onPickDay: (k: string) => void }) {
  const { state } = useStore();
  const t = targets(state.profile!);
  const byDay = new Map<string, number>();
  state.entries.forEach((e) => byDay.set(e.day, (byDay.get(e.day) ?? 0) + e.kcal));
  const days = [...byDay.keys()].sort().reverse();
  return (
    <Screen>
      <Title>Logs</Title>
      {days.length === 0 && <Text style={s.empty}>Nothing logged yet. Tap the green button to add your first meal.</Text>}
      <View style={{ gap: 10, marginHorizontal: 20 }}>
        {days.map((k) => {
          const kcal = byDay.get(k)!;
          const n = state.entries.filter((e) => e.day === k).length;
          return (
            <Pressable key={k} onPress={() => onPickDay(k)} style={[s.logRow, card]}>
              <View style={{ flex: 1 }}>
                <Text style={s.logDay}>{k === dayKey() ? 'Today' : fmtDay(k)}</Text>
                <Text style={s.logSub}>{n} {n === 1 ? 'item' : 'items'}</Text>
              </View>
              <Text style={[s.logKcal, kcal > t.kcal && { color: c.orange }]}>{fmt(kcal)}<Text style={s.logUnit}> / {fmt(t.kcal)}</Text></Text>
            </Pressable>
          );
        })}
      </View>
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
  const { state, reset, setSettings } = useStore();
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
  const toggleFit = async (on: boolean) => {
    if (!on) return setSettings({ fit: false });
    const r = await enableSteps();
    if (r === 'ok') return setSettings({ fit: true });
    Alert.alert(
      r === 'denied' ? 'Permission needed' : 'Health Connect not available',
      r === 'denied'
        ? 'Allow Lozzit to read your steps in the Health Connect permission screen, then try again.'
        : 'Steps are read through Health Connect, where Google Fit stores them. Install or update Health Connect from Google Play (on Android 14+ it is in Settings → Health Connect), then try again.',
    );
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
      <Text style={s.sect}>Settings</Text>
      <View style={[s.list, card]}>
        <View style={[s.li, { alignItems: 'center' }]}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={s.liT}>Sync steps with Google Fit</Text>
            <Text style={s.liS}>Reads your daily steps through Health Connect, where Google Fit saves them.</Text>
          </View>
          <Switch value={state.settings.fit} onValueChange={toggleFit} trackColor={{ true: c.lime, false: c.line }} thumbColor="#fff" />
        </View>
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
  sect: { fontFamily: f.extra, fontSize: 17, color: c.ink, marginHorizontal: 20, marginTop: 24, marginBottom: 10 },
  liT: { fontFamily: f.bold, fontSize: 15, color: c.ink },
  liS: { fontFamily: f.regular, fontSize: 12.5, color: c.muted, marginTop: 3, lineHeight: 18 },
  logRow: { borderRadius: 22, paddingHorizontal: 18, paddingVertical: 16, flexDirection: 'row', alignItems: 'center' },
  logDay: { fontFamily: f.bold, fontSize: 16, color: c.ink },
  logSub: { fontFamily: f.medium, fontSize: 12.5, color: c.muted, marginTop: 2 },
  logKcal: { fontFamily: f.extra, fontSize: 17, color: c.ink },
  logUnit: { fontFamily: f.semi, fontSize: 12.5, color: c.muted },
  reset: { alignSelf: 'center', marginTop: 24, paddingVertical: 12, paddingHorizontal: 18 },
  resetText: { fontFamily: f.bold, fontSize: 14, color: c.red },
});
