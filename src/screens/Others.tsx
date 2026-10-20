import React, { useEffect, useState } from 'react';
import { Alert, Modal, Platform, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { c, f } from '../theme';
import { ACTIVITY, autoBudget, autoMacros, dayKey, fmt, fmtDay, MEALS, targets } from '../domain';
import { useStore } from '../store';
import { card, Icon, P, Screen, Title } from '../ui';
import { enableSteps, listStepSources, sourceName } from '../steps';

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

export function Profile() {
  const { state, reset, setSettings, setProfile, setWeight } = useStore();
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
  const [picker, setPicker] = useState(false);
  const [sources, setSources] = useState<string[] | null>(null);
  useEffect(() => {
    if (picker) { setSources(null); listStepSources().then(setSources); }
  }, [picker]);
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
  type EditKey = 'age' | 'height' | 'weight' | 'goal' | 'activity' | 'budget' | 'macros' | 'stepGoal';
  const [edit, setEdit] = useState<EditKey | null>(null);
  const [vals, setVals] = useState<string[]>([]);
  const st = state.settings;
  const initial = (k: EditKey): string[] =>
    ({ age: [p.age], height: [p.heightCm], weight: [p.weightKg], goal: [p.goalKg], activity: [], budget: [t.kcal], macros: [t.protein, t.carbs, t.fat], stepGoal: [st.stepGoal] }[k].map(String));
  const open = (k: EditKey) => { setVals(initial(k)); setEdit(k); };
  const n = (i: number) => parseFloat((vals[i] ?? '').replace(',', '.'));
  const RANGE: Partial<Record<EditKey, [number, number]>> = { age: [10, 100], height: [100, 250], weight: [30, 300], goal: [30, 300], budget: [800, 6000], stepGoal: [1000, 50000] };
  const valid = !edit ? false : edit === 'macros' ? [0, 1, 2].every((i) => n(i) >= 0 && n(i) < 2000) : edit === 'activity' ? true : n(0) >= RANGE[edit]![0] && n(0) <= RANGE[edit]![1];
  const commit = () => {
    if (!edit || !valid) return;
    if (edit === 'age') setProfile({ ...p, age: Math.round(n(0)) });
    if (edit === 'height') setProfile({ ...p, heightCm: Math.round(n(0)) });
    if (edit === 'weight') setWeight(dayKey(), Math.round(n(0) * 10) / 10);
    if (edit === 'goal') setProfile({ ...p, goalKg: Math.round(n(0) * 10) / 10 });
    if (edit === 'budget') setProfile({ ...p, budget: Math.round(n(0)) });
    if (edit === 'macros') setProfile({ ...p, macros: { p: Math.round(n(0)), c: Math.round(n(1)), f: Math.round(n(2)) } });
    if (edit === 'stepGoal') setSettings({ stepGoal: Math.round(n(0)) });
    setEdit(null);
  };
  const auto = () => {
    if (edit === 'budget') setProfile({ ...p, budget: undefined });
    if (edit === 'macros') setProfile({ ...p, macros: undefined });
    setEdit(null);
  };
  const rows: [EditKey, string, string][] = [
    ['age', 'Age', `${p.age}`],
    ['height', 'Height', `${p.heightCm} cm`],
    ['weight', 'Weight', `${p.weightKg} kg`],
    ['goal', 'Goal weight', `${p.goalKg} kg`],
    ['activity', 'Activity', act],
    ['budget', 'Daily budget', `${fmt(t.kcal)} kcal${p.budget == null ? ' · auto' : ''}`],
    ['macros', 'Macro targets', `${t.protein}P · ${t.carbs}C · ${t.fat}F${p.macros ? '' : ' · auto'}`],
  ];
  const TITLES: Record<EditKey, string> = { age: 'Age', height: 'Height (cm)', weight: 'Weight (kg)', goal: 'Goal weight (kg)', activity: 'Activity', budget: 'Daily budget (kcal)', macros: 'Macro targets (g)', stepGoal: 'Daily step goal' };
  const toggleMeal = (k: (typeof MEALS)[number]['key']) => {
    const on = st.meals.includes(k);
    if (on && st.meals.length === 1) return;
    setSettings({ meals: MEALS.map((m) => m.key).filter((x) => (x === k ? !on : st.meals.includes(x))) });
  };
  const Row = ({ title, sub, value, onChange }: { title: string; sub?: string; value: boolean; onChange: (v: boolean) => void }) => (
    <View style={[s.li, { alignItems: 'center', borderTopWidth: 1, borderTopColor: c.line }]}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={s.liT}>{title}</Text>
        {sub ? <Text style={s.liS}>{sub}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: c.lime, false: c.line }} thumbColor="#fff" accessibilityLabel={title} />
    </View>
  );
  return (
    <Screen>
      <View style={s.pHead}>
        <View style={s.avatarRing}><View style={s.avatar}><Text style={s.avatarLetter}>{p.name.charAt(0).toUpperCase()}</Text></View></View>
        <Text style={s.pName}>{p.name}</Text>
      </View>
      <View style={[s.list, card]}>
        {rows.map(([key, k, v], i) => (
          <Pressable key={k} onPress={() => open(key)} style={[s.li, { alignItems: 'center' }, i > 0 && { borderTopWidth: 1, borderTopColor: c.line }]} accessibilityRole="button" accessibilityLabel={`Edit ${k}`}>
            <Text style={s.liK}>{k}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
              <Text style={[s.liV, { flexShrink: 1, textAlign: 'right' }]} numberOfLines={1}>{v}</Text>
              <Icon d={P.next} size={16} color={c.soft} />
            </View>
          </Pressable>
        ))}
      </View>
      <Text style={s.sect}>Settings</Text>
      <View style={[s.list, card]}>
        <View style={[s.li, { alignItems: 'center' }]}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={s.liT}>Sync steps</Text>
            <Text style={s.liS}>Reads your daily steps through Health Connect: Google Fit, Mi Fitness (Mi Band), Samsung Health…</Text>
          </View>
          <Switch value={state.settings.fit} onValueChange={toggleFit} trackColor={{ true: c.lime, false: c.line }} thumbColor="#fff" />
        </View>
        {state.settings.fit && (
          <Pressable onPress={() => open('stepGoal')} style={[s.li, { borderTopWidth: 1, borderTopColor: c.line, alignItems: 'center' }]} accessibilityRole="button">
            <Text style={s.liT}>Daily step goal</Text>
            <Text style={[s.liV, { color: c.limeText }]}>{fmt(st.stepGoal)}</Text>
          </Pressable>
        )}
        {state.settings.fit && (
          <Pressable onPress={() => setPicker(true)} style={[s.li, { borderTopWidth: 1, borderTopColor: c.line, alignItems: 'center' }]} accessibilityRole="button">
            <Text style={s.liT}>Steps source</Text>
            <Text style={[s.liV, { color: c.limeText }]}>{sourceName(state.settings.stepSource)}</Text>
          </Pressable>
        )}
      </View>
      <Text style={s.sect}>Meals</Text>
      <View style={[s.list, card]}>
        <Text style={[s.liS, { paddingTop: 14 }]}>Choose the meals you use. A meal you turn off disappears from the dashboard, but stays visible on days where it already has food.</Text>
        {MEALS.map((m) => <Row key={m.key} title={m.label} value={st.meals.includes(m.key)} onChange={() => toggleMeal(m.key)} />)}
      </View>
      <Text style={s.sect}>Nutrition on the dashboard</Text>
      <View style={[s.list, card]}>
        <Text style={[s.liS, { paddingTop: 14 }]}>Show a smaller bar under Carbs and under Fat. Values come from the foods you log.</Text>
        <Row title="Sugar" sub="under Carbs" value={st.showSugar} onChange={(v) => setSettings({ showSugar: v })} />
        <Row title="Salt" sub="under Fat" value={st.showSalt} onChange={(v) => setSettings({ showSalt: v })} />
        <Row title="Fiber" sub="under Fat" value={st.showFiber} onChange={(v) => setSettings({ showFiber: v })} />
        <Row title="Saturated fat" sub="under Fat" value={st.showSat} onChange={(v) => setSettings({ showSat: v })} />
      </View>
      <Modal visible={!!edit} transparent animationType="fade" onRequestClose={() => setEdit(null)} statusBarTranslucent>
        <View style={s.mWrap}>
          <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} onPress={() => setEdit(null)} />
          {edit && (
            <View style={s.mCard}>
              <Text style={s.mTitle}>{TITLES[edit]}</Text>
              {edit === 'activity' ? (
                ACTIVITY.map((a) => (
                  <Pressable key={a.v} onPress={() => { setProfile({ ...p, activity: a.v }); setEdit(null); }} style={s.mRow} accessibilityRole="button">
                    <View style={{ flex: 1 }}><Text style={s.liT}>{a.label}</Text></View>
                    <View style={[s.radio, p.activity === a.v && { borderColor: c.ink, backgroundColor: c.ink }]} />
                  </Pressable>
                ))
              ) : edit === 'macros' ? (
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  {['Protein', 'Carbs', 'Fat'].map((l, i) => (
                    <View key={l} style={s.fieldBox}>
                      <Text style={s.fieldL}>{l}</Text>
                      <TextInput style={s.field} value={vals[i]} onChangeText={(x) => setVals((v) => v.map((y, j) => (j === i ? x : y)))} keyboardType="number-pad" maxLength={4} selectTextOnFocus selectionColor={c.lime} accessibilityLabel={l} />
                    </View>
                  ))}
                </View>
              ) : (
                <TextInput style={[s.field, s.fieldBig]} value={vals[0]} onChangeText={(x) => setVals([x])} keyboardType="decimal-pad" maxLength={6} selectTextOnFocus selectionColor={c.lime} autoFocus accessibilityLabel={TITLES[edit]} />
              )}
              {edit === 'budget' && <Text style={s.liS}>Auto = {fmt(autoBudget(p))} kcal, from your weight, height, age, activity and goal.</Text>}
              {edit === 'macros' && <Text style={s.liS}>Auto = {autoMacros(p, t.kcal).p}P · {autoMacros(p, t.kcal).c}C · {autoMacros(p, t.kcal).f}F for your budget.</Text>}
              {edit !== 'activity' && (
                <>
                  <Pressable onPress={commit} disabled={!valid} style={[s.save, !valid && { opacity: 0.35 }]} accessibilityRole="button"><Text style={s.saveT}>Save</Text></Pressable>
                  {(edit === 'budget' || edit === 'macros') && (
                    <Pressable onPress={auto} style={{ alignSelf: 'center', padding: 8 }} accessibilityRole="button"><Text style={s.link}>Use auto</Text></Pressable>
                  )}
                </>
              )}
            </View>
          )}
        </View>
      </Modal>
      <Text style={s.credit}>Food data: Anses Ciqual 2025 (Licence Ouverte Etalab 2.0) · Open Food Facts (ODbL)</Text>
      <Modal visible={picker} transparent animationType="fade" onRequestClose={() => setPicker(false)} statusBarTranslucent>
        <View style={s.mWrap}>
          <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} onPress={() => setPicker(false)} />
          <View style={s.mCard}>
            <Text style={s.mTitle}>Steps source</Text>
            {['all', ...(sources ?? [])].map((pkg) => (
              <Pressable key={pkg} onPress={() => { setSettings({ stepSource: pkg }); setPicker(false); }} style={s.mRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.liT}>{sourceName(pkg)}</Text>
                  <Text style={s.liS}>{pkg === 'all' ? 'Android merges every app and avoids double counting' : pkg}</Text>
                </View>
                <View style={[s.radio, state.settings.stepSource === pkg && { borderColor: c.ink, backgroundColor: c.ink }]} />
              </Pressable>
            ))}
            {sources && sources.length === 0 && <Text style={s.liS}>No step data found yet. Open Mi Fitness or Google Fit, sync, and enable Health Connect sharing there.</Text>}
            {sources === null && <Text style={s.liS}>Looking for apps…</Text>}
          </View>
        </View>
      </Modal>
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
  credit: { fontFamily: f.regular, fontSize: 11.5, color: c.soft, marginHorizontal: 20, marginTop: 10, textAlign: 'center' },
  mWrap: { flex: 1, backgroundColor: 'rgba(21,32,15,0.4)', justifyContent: 'center', paddingHorizontal: 20 },
  mCard: { backgroundColor: '#fff', borderRadius: 28, padding: 20, gap: 4 },
  mTitle: { fontFamily: f.extra, fontSize: 18, color: c.ink, marginBottom: 8 },
  mRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: c.line },
  fieldBox: { flex: 1, backgroundColor: c.page, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8 },
  fieldL: { fontFamily: f.semi, fontSize: 11.5, color: c.muted },
  field: { fontFamily: f.extra, fontSize: 20, color: c.ink, paddingVertical: 2 },
  fieldBig: { backgroundColor: c.page, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 12, fontSize: 30 },
  save: { height: 54, borderRadius: 27, backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  saveT: { fontFamily: f.bold, fontSize: 16, color: c.lime },
  link: { fontFamily: f.bold, fontSize: 14, color: c.limeText },
  reset: { alignSelf: 'center', marginTop: 24, paddingVertical: 12, paddingHorizontal: 18 },
  resetText: { fontFamily: f.bold, fontSize: 14, color: c.red },
});
