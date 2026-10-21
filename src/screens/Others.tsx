import React, { useEffect, useState } from 'react';
import { Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { askConfirm, notify } from '../dialog';
import { Text, TextInput, tr } from '../i18n';
import { exportBackup, pickBackup } from '../backup';
import { c, f, onTheme } from '../theme';
import { ACTIVITY, autoBudget, autoMacros, budgetFor, dayKey, fmt, fmtDay, MEALS, METHODS, resolveMacros, targets, type MacroRule } from '../domain';
import { useStore } from '../store';
import { card, Icon, P, Screen, Title, KbView } from '../ui';
import { enableSteps, listStepSources, sourceName } from '../steps';

/** Logs: every day with something logged, newest first. Tap a day to open it on the dashboard. */
export function Profile() {
  const { state, reset, setSettings, setProfile, setWeight, exportData, importData } = useStore();
  const p = state.profile!;
  const t = targets(p);
  const act = ACTIVITY.find((a) => a.v === p.activity)?.label ?? '';
  const confirmReset = () => {
    askConfirm({ title: 'Delete profile?', message: 'This deletes your profile and everything you logged on this phone.', confirmText: tr('Delete profile'), danger: true }).then((ok) => { if (ok) reset(); });
  };
  const [dataMsg, setDataMsg] = useState('');
  const doExport = async () => {
    try {
      const r = await exportBackup(exportData());
      setDataMsg(r === 'unavailable' ? 'Could not open the share sheet on this device.' : 'Backup file ready.');
    } catch { setDataMsg('Could not create the backup file.'); }
  };
  const doImport = async () => {
    try {
      const raw = await pickBackup();
      if (raw == null) return;
      const apply = () => setDataMsg(importData(raw) ? 'Data imported.' : 'This file is not a Lozzit backup.');
      if (await askConfirm({ title: 'Import data', message: 'This replaces everything on this phone with the content of the file.', confirmText: tr('Import data'), danger: true })) apply();
    } catch { setDataMsg('Could not read this file.'); }
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
    notify(
      r === 'denied' ? 'Permission needed' : 'Health Connect not available',
      r === 'denied'
        ? 'Allow Lozzit to read your steps in the Health Connect permission screen, then try again.'
        : 'Steps are read through Health Connect, where Google Fit stores them. Install or update Health Connect from Google Play (on Android 14+ it is in Settings → Health Connect), then try again.',
    );
  };
  type EditKey = 'age' | 'height' | 'weight' | 'goal' | 'activity' | 'budget' | 'macros' | 'stepGoal';
  const [edit, setEdit] = useState<EditKey | null>(null);
  const [vals, setVals] = useState<string[]>([]);
  type RS = { t: MacroRule['t']; v: string };
  const [rl, setRl] = useState<RS[]>([]);
  const st = state.settings;
  const initial = (k: EditKey): string[] =>
    ({ age: [p.age], height: [p.heightCm], weight: [p.weightKg], goal: [p.goalKg], activity: [], budget: [''], macros: [t.protein, t.carbs, t.fat], stepGoal: [st.stepGoal] }[k].map(String));
  const open = (k: EditKey) => {
    setVals(initial(k));
    if (k === 'macros') {
      const ks = ['p', 'c', 'f'] as const;
      setRl(ks.map((x, i) => (p.rules ? { t: p.rules[x].t, v: String(p.rules[x].v) } : p.macros ? { t: 'g' as const, v: String([t.protein, t.carbs, t.fat][i]) } : { t: 'auto' as const, v: '' })));
    }
    setEdit(k);
  };
  const rulesOf = (): NonNullable<typeof p.rules> => {
    const f = (r: RS): MacroRule => ({ t: r.t, v: r.t === 'auto' ? 0 : parseFloat(r.v.replace(',', '.')) });
    return { p: f(rl[0]), c: f(rl[1]), f: f(rl[2]) };
  };
  const AUTO_RULES: NonNullable<typeof p.rules> = { p: { t: 'auto', v: 0 }, c: { t: 'auto', v: 0 }, f: { t: 'auto', v: 0 } };
  const rulesOk = rl.length === 3 && rl.every((r) => r.t === 'auto' || (Number.isFinite(parseFloat(r.v.replace(',', '.'))) && parseFloat(r.v.replace(',', '.')) >= 0));
  const n = (i: number) => parseFloat((vals[i] ?? '').replace(',', '.'));
  const RANGE: Partial<Record<EditKey, [number, number]>> = { age: [10, 100], height: [100, 250], weight: [30, 300], goal: [30, 300], budget: [800, 6000], stepGoal: [1000, 50000] };
  const valid = !edit ? false : edit === 'macros' ? rulesOk : edit === 'activity' || (edit === 'budget' && !vals[0]) ? true : n(0) >= RANGE[edit]![0] && n(0) <= RANGE[edit]![1];
  const commit = () => {
    if (!edit || !valid) return;
    if (edit === 'budget' && !vals[0]) return setEdit(null);
    if (edit === 'age') setProfile({ ...p, age: Math.round(n(0)) });
    if (edit === 'height') setProfile({ ...p, heightCm: Math.round(n(0)) });
    if (edit === 'weight') setWeight(dayKey(), Math.round(n(0) * 10) / 10);
    if (edit === 'goal') setProfile({ ...p, goalKg: Math.round(n(0) * 10) / 10 });
    if (edit === 'budget') setProfile({ ...p, budget: Math.round(n(0)) });
    if (edit === 'macros') setProfile({ ...p, macros: undefined, rules: rl.every((r) => r.t === 'auto') ? undefined : rulesOf() });
    if (edit === 'stepGoal') setSettings({ stepGoal: Math.round(n(0)) });
    setEdit(null);
  };
  const auto = () => {
    if (edit === 'budget') setProfile({ ...p, budget: undefined });
    if (edit === 'macros') setProfile({ ...p, macros: undefined, rules: undefined });
    setEdit(null);
  };
  const rows: [EditKey, string, string][] = [
    ['age', 'Age', `${p.age}`],
    ['height', 'Height', `${p.heightCm} cm`],
    ['weight', 'Weight', `${p.weightKg} kg`],
    ['goal', 'Goal weight', `${p.goalKg} kg`],
    ['activity', 'Activity', act],
    ['budget', 'Daily budget', `${fmt(t.kcal)} kcal${p.budget == null ? ' · ' + budgetFor(p).method.name.split(' ')[0] : ' · custom'}`],
    ['macros', 'Macro targets', `${t.protein}P · ${t.carbs}C · ${t.fat}F${p.macros || p.rules ? '' : ' · auto'}`],
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
      <Text style={s.sect}>Appearance</Text>
      <View style={[s.list, card]}>
        <View style={[s.li, { flexDirection: 'column', gap: 10 }]}>
          <Text style={s.liT}>Theme</Text>
          <View style={s.segRow}>
            {([['light', 'Light'], ['dark', 'Dark'], ['system', 'System']] as const).map(([k, l]) => (
              <Pressable key={k} onPress={() => setSettings({ theme: k })} style={[s.segB, st.theme === k && { backgroundColor: c.btn }]} accessibilityRole="button" accessibilityState={{ selected: st.theme === k }}>
                <Text style={[s.segT, st.theme === k && { color: '#fff' }]}>{l}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <View style={[s.li, { flexDirection: 'column', gap: 10, borderTopWidth: 1, borderTopColor: c.line }]}>
          <Text style={s.liT}>Language</Text>
          <View style={s.segRow}>
            {([['en', 'English'], ['fr', 'Français']] as const).map(([k, l]) => (
              <Pressable key={k} onPress={() => setSettings({ lang: k })} style={[s.segB, st.lang === k && { backgroundColor: c.btn }]} accessibilityRole="button" accessibilityState={{ selected: st.lang === k }}>
                <Text style={[s.segT, st.lang === k && { color: '#fff' }]}>{l}</Text>
              </Pressable>
            ))}
          </View>
        </View>
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
      <Text style={s.sect}>AI label scan</Text>
      <View style={[s.list, card]}>
        <Text style={[s.liS, { paddingTop: 14 }]}>Photograph a nutrition table when you create a food: a Groq vision model reads carbs, sugar, protein, fat, saturated fat, salt and fiber. Get a key on console.groq.com/keys. The key stays on this phone; each photo is sent to Groq.</Text>
        <View style={{ paddingVertical: 12, gap: 8 }}>
          <Text style={s.fieldL}>API key</Text>
          <TextInput style={s.keyIn} value={st.groqKey} onChangeText={(x) => setSettings({ groqKey: x.trim() })} placeholder="gsk_…" placeholderTextColor={c.soft} secureTextEntry autoCapitalize="none" autoCorrect={false} selectionColor={c.lime} accessibilityLabel="Groq API key" />
          <Text style={s.fieldL}>Model</Text>
          <TextInput style={s.keyIn} value={st.groqModel} onChangeText={(x) => setSettings({ groqModel: x.trim() })} placeholder="qwen/qwen3.8-27b" placeholderTextColor={c.soft} autoCapitalize="none" autoCorrect={false} selectionColor={c.lime} accessibilityLabel="Groq model" />
          <Pressable onPress={() => Linking.openURL('https://console.groq.com/keys')} accessibilityRole="link"><Text style={s.link}>Get a Groq API key</Text></Pressable>
        </View>
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
        <KbView style={s.mWrap}>
          <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} onPress={() => setEdit(null)} />
          {edit && (
            <View style={s.mCard}>
              <Text style={s.mTitle}>{TITLES[edit]}</Text>
              {edit === 'activity' ? (
                ACTIVITY.map((a) => (
                  <Pressable key={a.v} onPress={() => { setProfile({ ...p, activity: a.v }); setEdit(null); }} style={s.mRow} accessibilityRole="button">
                    <View style={{ flex: 1 }}><Text style={s.liT}>{a.label}</Text></View>
                    <View style={[s.radio, p.activity === a.v && { borderColor: c.btn, backgroundColor: c.btn }]} />
                  </Pressable>
                ))
              ) : edit === 'macros' ? (
                <View style={{ gap: 12 }}>
                  <Text style={s.liS}>Fix the macros you care about. “Auto” ones share the calories that are left, in proportion to the default split.</Text>
                  {(['Protein', 'Carbs', 'Fat'] as const).map((l, i) => {
                    const res = resolveMacros(p, t.kcal, rulesOk ? rulesOf() : AUTO_RULES);
                    const g = [res.p, res.c, res.f][i];
                    return (
                      <View key={l}>
                        <View style={s.mRowH}>
                          <Text style={s.liT}>{l}</Text>
                          <Text style={s.liV}>{g} g · {fmt(g * [4, 4, 9][i])} kcal</Text>
                        </View>
                        <View style={s.chipsRow}>
                          {([['auto', 'Auto'], ['gkg', 'g / kg'], ['pct', '% kcal'], ['g', 'grams']] as const).map(([tt, lab]) => (
                            <Pressable key={tt} onPress={() => setRl((r) => r.map((x, j) => (j === i ? { t: tt, v: x.t === tt ? x.v : tt === 'gkg' ? String(Math.round((g / p.weightKg) * 10) / 10) : tt === 'pct' ? String(Math.round((g * [4, 4, 9][i] * 100) / t.kcal)) : tt === 'g' ? String(g) : '' } : x)))} style={[s.opt, rl[i]?.t === tt && { backgroundColor: c.btn }]} accessibilityRole="button" accessibilityLabel={`${l} ${lab}`}>
                              <Text style={[s.optT, rl[i]?.t === tt && { color: c.lime }]}>{lab}</Text>
                            </Pressable>
                          ))}
                          {rl[i] && rl[i].t !== 'auto' && (
                            <TextInput style={s.optIn} value={rl[i].v} onChangeText={(x) => setRl((r) => r.map((y, j) => (j === i ? { ...y, v: x } : y)))} keyboardType="decimal-pad" maxLength={5} selectTextOnFocus selectionColor={c.lime} accessibilityLabel={`${l} value`} />
                          )}
                        </View>
                      </View>
                    );
                  })}
                  {(() => {
                    const res = resolveMacros(p, t.kcal, rulesOk ? rulesOf() : AUTO_RULES);
                    const total = res.p * 4 + res.c * 4 + res.f * 9;
                    return <Text style={[s.liS, Math.abs(total - t.kcal) > t.kcal * 0.03 && { color: c.orange }]}>{`Total ${fmt(total)} kcal for a ${fmt(t.kcal)} kcal budget${total > t.kcal * 1.03 ? ': your fixed macros are above the budget.' : total < t.kcal * 0.97 ? ': every macro is fixed, the rest is unassigned.' : '.'}`}</Text>;
                  })()}
                </View>
              ) : edit === 'budget' ? (
                <ScrollView style={{ maxHeight: 540 }} contentContainerStyle={{ gap: 6 }} keyboardShouldPersistTaps="handled">
                  <Text style={s.liS}>Pick how your resting energy is estimated. Then activity and your goal are applied the same way.</Text>
                  {METHODS.map((m) => {
                    const b = budgetFor(p, m.key);
                    const on = !p.budget && budgetFor(p).method.key === m.key;
                    return (
                      <Pressable key={m.key} onPress={() => { setProfile({ ...p, method: m.key, budget: undefined }); }} style={[s.method, on && { borderColor: c.btn }]} accessibilityRole="button" accessibilityLabel={m.name}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.liT}>{m.name}</Text>
                          <Text style={s.liS}>{m.source}</Text>
                        </View>
                        <Text style={s.methodV}>{fmt(b.kcal)}</Text>
                      </Pressable>
                    );
                  })}
                  {(() => {
                    const b = budgetFor(p);
                    return (
                      <View style={s.detail}>
                        <Text style={s.detailH}>{b.method.name}{p.budget ? ' (custom budget set below)' : ''}</Text>
                        <Text style={s.detailL}>1. Resting energy: {b.text}</Text>
                        <Text style={s.detailL}>2. × activity {p.activity} ({ACTIVITY.find((a) => a.v === p.activity)?.label ?? 'custom'}) = {fmt(b.tdee)} kcal to maintain your weight</Text>
                        <Text style={s.detailL}>3. Goal: {b.why}</Text>
                        <Text style={s.detailL}>4. {fmt(b.tdee)} {b.adj >= 0 ? '+' : '−'} {Math.abs(b.adj)} = {fmt(b.raw)} → rounded to {fmt(b.kcal)} kcal{b.floored ? ' (never below 1,200)' : ''}</Text>
                      </View>
                    );
                  })()}
                  <Text style={[s.liT, { marginTop: 8 }]}>Or set your own</Text>
                  <TextInput style={[s.field, s.fieldBig]} value={vals[0]} onChangeText={(x) => setVals([x])} placeholder={String(t.kcal)} placeholderTextColor={c.soft} keyboardType="decimal-pad" maxLength={5} selectTextOnFocus selectionColor={c.lime} accessibilityLabel="Daily budget (kcal)" />
                </ScrollView>
              ) : (
                <TextInput style={[s.field, s.fieldBig]} value={vals[0]} onChangeText={(x) => setVals([x])} keyboardType="decimal-pad" maxLength={6} selectTextOnFocus selectionColor={c.lime} autoFocus accessibilityLabel={TITLES[edit]} />
              )}
              {edit !== 'activity' && (
                <>
                  <Pressable onPress={commit} disabled={!valid} style={[s.save, !valid && { opacity: 0.35 }]} accessibilityRole="button"><Text style={s.saveT}>{edit === 'budget' ? (vals[0] ? 'Save custom budget' : 'Done') : 'Save'}</Text></Pressable>
                  {(edit === 'budget' || edit === 'macros') && (
                    <Pressable onPress={auto} style={{ alignSelf: 'center', padding: 8 }} accessibilityRole="button"><Text style={s.link}>Use auto</Text></Pressable>
                  )}
                </>
              )}
            </View>
          )}
        </KbView>
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
                <View style={[s.radio, state.settings.stepSource === pkg && { borderColor: c.btn, backgroundColor: c.btn }]} />
              </Pressable>
            ))}
            {sources && sources.length === 0 && <Text style={s.liS}>No step data found yet. Open Mi Fitness or Google Fit, sync, and enable Health Connect sharing there.</Text>}
            {sources === null && <Text style={s.liS}>Looking for apps…</Text>}
          </View>
        </View>
      </Modal>
      <Text style={s.sect}>Data</Text>
      <View style={[s.list, card]}>
        <Text style={[s.liS, { paddingTop: 14 }]}>Save everything (profile, log, foods, recipes, settings) in a file, or restore it from a file. Your API key is not included.</Text>
        <Pressable onPress={doExport} style={[s.li, { alignItems: 'center', borderTopWidth: 1, borderTopColor: c.line, marginTop: 10 }]} accessibilityRole="button">
          <Text style={s.liT}>Export data</Text>
          <Icon d={P.next} size={16} color={c.soft} />
        </Pressable>
        <Pressable onPress={doImport} style={[s.li, { alignItems: 'center', borderTopWidth: 1, borderTopColor: c.line }]} accessibilityRole="button">
          <Text style={s.liT}>Import data</Text>
          <Icon d={P.next} size={16} color={c.soft} />
        </Pressable>
        {dataMsg ? <Text style={[s.liS, { paddingBottom: 12, color: /^Could|^This/.test(dataMsg) ? c.red : c.limeText }]}>{dataMsg}</Text> : null}
      </View>
      <Pressable onPress={confirmReset} style={s.reset} accessibilityRole="button">
        <Text style={s.resetText}>Delete profile</Text>
      </Pressable>
    </Screen>
  );
}

const mkStyles = () => StyleSheet.create({
  segRow: { flexDirection: 'row', gap: 8 },
  segB: { flex: 1, height: 40, borderRadius: 20, backgroundColor: c.page, alignItems: 'center', justifyContent: 'center' },
  segT: { fontFamily: f.bold, fontSize: 13.5, color: c.ink },
  empty: { fontFamily: f.regular, fontSize: 15, color: c.muted, marginHorizontal: 10, lineHeight: 22 },
  group: { marginHorizontal: 10, marginBottom: 20 },
  groupHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  groupName: { fontFamily: f.extra, fontSize: 17, color: c.ink },
  groupKcal: { fontFamily: f.bold, fontSize: 14, color: c.limeText },
  panel: { marginHorizontal: 10, borderRadius: 28, padding: 18, height: 230 },
  chart: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', flex: 1 },
  col: { alignItems: 'center', width: 34 },
  colTrack: { height: 140, justifyContent: 'flex-end', width: 22 },
  colL: { fontFamily: f.semi, fontSize: 12, color: c.soft, marginTop: 10 },
  limit: { position: 'absolute', left: 18, right: 18, height: 1, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: c.soft },
  statRow: { flexDirection: 'row', gap: 12, marginHorizontal: 10, marginTop: 12 },
  stat: { flex: 1, borderRadius: 24, padding: 16 },
  statL: { fontFamily: f.semi, fontSize: 13, color: c.muted },
  statV: { fontFamily: f.extra, fontSize: 24, color: c.ink, letterSpacing: -0.6, marginTop: 4 },
  pHead: { alignItems: 'center', gap: 12, marginBottom: 22 },
  avatarRing: { width: 84, height: 84, borderRadius: 42, borderWidth: 3, borderColor: c.lime, padding: 4 },
  avatar: { flex: 1, borderRadius: 40, backgroundColor: c.btn, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontFamily: f.extra, fontSize: 32, color: c.lime },
  pName: { fontFamily: f.extra, fontSize: 24, color: c.ink, letterSpacing: -0.5 },
  list: { marginHorizontal: 10, borderRadius: 26, paddingHorizontal: 18 },
  li: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 15 },
  liK: { fontFamily: f.medium, fontSize: 14, color: c.muted },
  liV: { fontFamily: f.bold, fontSize: 14, color: c.ink },
  sect: { fontFamily: f.extra, fontSize: 17, color: c.ink, marginHorizontal: 10, marginTop: 24, marginBottom: 10 },
  liT: { fontFamily: f.bold, fontSize: 15, color: c.ink },
  liS: { fontFamily: f.regular, fontSize: 12.5, color: c.muted, marginTop: 3, lineHeight: 18 },
  logRow: { borderRadius: 22, paddingHorizontal: 18, paddingVertical: 16, flexDirection: 'row', alignItems: 'center' },
  logDay: { fontFamily: f.bold, fontSize: 16, color: c.ink },
  logSub: { fontFamily: f.medium, fontSize: 12.5, color: c.muted, marginTop: 2 },
  logKcal: { fontFamily: f.extra, fontSize: 17, color: c.ink },
  logUnit: { fontFamily: f.semi, fontSize: 12.5, color: c.muted },
  credit: { fontFamily: f.regular, fontSize: 11.5, color: c.soft, marginHorizontal: 10, marginTop: 10, textAlign: 'center' },
  mWrap: { flex: 1, backgroundColor: 'rgba(21,32,15,0.4)', justifyContent: 'center', paddingHorizontal: 20 },
  mCard: { backgroundColor: c.card, borderRadius: 28, padding: 20, gap: 4 },
  mTitle: { fontFamily: f.extra, fontSize: 18, color: c.ink, marginBottom: 8 },
  mRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: c.line },
  fieldBox: { flex: 1, backgroundColor: c.page, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8 },
  fieldL: { fontFamily: f.semi, fontSize: 11.5, color: c.muted },
  field: { fontFamily: f.extra, fontSize: 20, color: c.ink, paddingVertical: 2 },
  fieldBig: { backgroundColor: c.page, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 12, fontSize: 30 },
  save: { height: 54, borderRadius: 27, backgroundColor: c.btn, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  saveT: { fontFamily: f.bold, fontSize: 16, color: c.lime },
  link: { fontFamily: f.bold, fontSize: 14, color: c.limeText },
  mRowH: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  opt: { backgroundColor: c.page, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  optT: { fontFamily: f.bold, fontSize: 12.5, color: c.ink },
  optIn: { minWidth: 64, backgroundColor: c.page, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6, fontFamily: f.extra, fontSize: 15, color: c.ink },
  method: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 2, borderColor: c.line, borderRadius: 18, padding: 12 },
  methodV: { fontFamily: f.extra, fontSize: 17, color: c.ink },
  detail: { backgroundColor: c.page, borderRadius: 18, padding: 14, gap: 6, marginTop: 4 },
  detailH: { fontFamily: f.extra, fontSize: 14, color: c.ink },
  detailL: { fontFamily: f.regular, fontSize: 12.5, color: c.ink, lineHeight: 18 },
  keyIn: { backgroundColor: c.page, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 11, fontFamily: f.medium, fontSize: 14.5, color: c.ink },
  reset: { alignSelf: 'center', marginTop: 24, paddingVertical: 12, paddingHorizontal: 18 },
  resetText: { fontFamily: f.bold, fontSize: 14, color: c.red },
});
let s = mkStyles();
onTheme(() => { s = mkStyles(); });
