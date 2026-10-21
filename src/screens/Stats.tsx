import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput, tr } from '../i18n';
import { askConfirm } from '../dialog';
import { Calendar } from './Calendar';
import Svg, { Circle, Line, Path, Text as SText } from 'react-native-svg';
import { c, f, onTheme } from '../theme';
import { addDays, dayKey, fmt, fmtDay, parseKey, sum, targets, weekDays } from '../domain';
import { useStore } from '../store';
import { useSteps } from '../steps';
import { card, Icon, KbView, P, Screen, Title } from '../ui';

const FAT = '#F6B26B', CARB = '#5BAEDC', PROT = '#6C63E0';
const BAR_H = 150;

const polar = (cx: number, cy: number, r: number, deg: number) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
};
const OUT = 'rgba(128,128,128,0.4)';
const arc = (cx: number, cy: number, r: number, a0: number, a1: number) => {
  const [x0, y0] = polar(cx, cy, r, a0);
  const [x1, y1] = polar(cx, cy, r, a1);
  return `M${x0} ${y0} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}`;
};

/** Open ring gauge (240°) filled to `pct`. */
function Gauge({ pct, color, big, small, foot }: { pct: number; color: string; big: string; small: string; foot: string }) {
  const S = 128, a0 = 150, sweep = 240, p = Math.max(0, Math.min(pct, 1));
  return (
    <View style={{ width: S + 8, alignItems: 'center' }}>
      <View style={{ width: S, height: S }}>
        <Svg width={S} height={S} viewBox={`0 0 ${S} ${S}`}>
          <Path d={arc(S / 2, S / 2, 54, a0, a0 + sweep)} stroke={OUT} strokeWidth={18} strokeLinecap="round" fill="none" />
          <Path d={arc(S / 2, S / 2, 54, a0, a0 + sweep)} stroke={c.line} strokeWidth={14} strokeLinecap="round" fill="none" />
          {p > 0 && <Path d={arc(S / 2, S / 2, 54, a0, a0 + sweep * Math.max(p, 0.02))} stroke={color} strokeWidth={14} strokeLinecap="round" fill="none" />}
        </Svg>
        <View style={s.gaugeC}>
          <Text style={s.gaugeBig}>{big}</Text>
          <Text style={s.gaugeSmall}>{small}</Text>
        </View>
      </View>
      <Text style={s.gaugeFoot}>{foot}</Text>
    </View>
  );
}

type Day = ReturnType<typeof weekDays>[number];

/** One vertical track per weekday: filled to value/goal, check mark when `done`. */
function DayBars({ days, values, goal, done, over }: { days: Day[]; values: number[]; goal: number; done: boolean[]; over?: (i: number) => boolean }) {
  return (
    <View style={s.bars}>
      {days.map((d, i) => {
        const h = Math.min(values[i] / goal, 1) * BAR_H;
        return (
          <View key={d.key} style={s.barCol}>
            <View style={s.track}>
              {values[i] > 0 && (
                <View style={[s.fill, { height: Math.max(h, 8), backgroundColor: over?.(i) ? c.orange : c.lime }]}>
                  {done[i] && <View style={{ marginBottom: 4 }}><Icon d={['M5 12.5l4.5 4.5L19 7.5']} size={16} sw={3} color={c.ink} /></View>}
                </View>
              )}
            </View>
            <Text style={[s.barL, d.isToday && { color: c.ink, fontFamily: f.bold }]}>{d.letter}</Text>
          </View>
        );
      })}
    </View>
  );
}

function CardHead({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <View style={s.cardHead}>
      <Text style={s.cardT}>{title}</Text>
      {right}
    </View>
  );
}

const RANGES: [string, string, number][] = [['1W', '1 week', 7], ['1M', '1 month', 30], ['3M', '3 months', 91], ['6M', '6 months', 182], ['1Y', '1 year', 365], ['All', 'Since inception', Infinity]];
const shortDate = (k: string) => { const d = parseKey(k); return `${d.getDate()} ${tr(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()])}`; };

function WeightChart({ pts, goal }: { pts: [string, number][]; goal: number }) {
  const [w, setW] = useState(300);
  const H = 160, padL = 34, padR = 8, padT = 10, padB = 22;
  if (!pts.length) return <Text style={s.empty}>No weigh-in in this period. Tap + to log your weight.</Text>;
  const t0 = parseKey(pts[0][0]).getTime(), t1 = parseKey(pts[pts.length - 1][0]).getTime();
  const vals = pts.map((p) => p[1]);
  let lo = Math.min(...vals, goal), hi = Math.max(...vals, goal);
  if (hi - lo < 2) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.1; lo -= pad; hi += pad;
  const X = (k: string) => (t1 === t0 ? padL + (w - padL - padR) / 2 : padL + ((parseKey(k).getTime() - t0) / (t1 - t0)) * (w - padL - padR));
  const Y = (v: number) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p[0])} ${Y(p[1])}`).join(' ');
  const ticks = [hi - pad, (hi + lo) / 2, lo + pad];
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      <Svg width={w} height={H}>
        {ticks.map((v, i) => (
          <React.Fragment key={i}>
            <Line x1={padL} x2={w - padR} y1={Y(v)} y2={Y(v)} stroke={c.line} strokeWidth={1} />
            <SText x={0} y={Y(v) + 4} fontSize={11} fill={c.muted}>{v.toFixed(1)}</SText>
          </React.Fragment>
        ))}
        {goal >= lo && goal <= hi && <Line x1={padL} x2={w - padR} y1={Y(goal)} y2={Y(goal)} stroke={c.limeText} strokeWidth={1.5} strokeDasharray="5 4" />}
        {pts.length > 1 && <Path d={path} stroke={c.ink} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />}
        {pts.map((p) => <Circle key={p[0]} cx={X(p[0])} cy={Y(p[1])} r={pts.length > 40 ? 0 : 4} fill={c.lime} stroke={c.ink} strokeWidth={2} />)}
        <SText x={padL} y={H - 4} fontSize={11} fill={c.muted}>{shortDate(pts[0][0])}</SText>
        {pts.length > 1 && <SText x={w - padR} y={H - 4} fontSize={11} fill={c.muted} textAnchor="end">{shortDate(pts[pts.length - 1][0])}</SText>}
      </Svg>
    </View>
  );
}

/** History of weigh-ins: edit (value and date) or delete each one. */
function WeightLogs({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { state, setWeight, removeWeight } = useStore();
  const [ed, setEd] = useState<{ day: string; to: string; kg: string } | null>(null);
  const [cal, setCal] = useState(false);
  const rows = Object.entries(state.weights).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  const kgNum = ed ? parseFloat(ed.kg.replace(',', '.')) : NaN;
  const ok = Number.isFinite(kgNum) && kgNum >= 20 && kgNum <= 400;
  const save = () => {
    if (!ed || !ok) return;
    if (ed.to !== ed.day) removeWeight(ed.day);
    setWeight(ed.to, Math.round(kgNum * 10) / 10);
    setEd(null);
  };
  const del = (day: string) => askConfirm({ title: 'Delete this weigh-in?', message: fmtDay(day), confirmText: tr('Delete'), danger: true }).then((o) => { if (o) removeWeight(day); });
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={s.lWrap}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <View style={s.lBox}>
          <View style={s.lHead}>
            <Text style={s.cardT}>Weight logs</Text>
            <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close logs"><Icon d={P.x} size={20} color={c.muted} /></Pressable>
          </View>
          {rows.length === 0 ? <Text style={s.empty}>No weigh-in yet.</Text> : (
            <ScrollView style={{ maxHeight: 420 }}>
              {rows.map(([d, kg], i) => (
                <View key={d} style={[s.lRow, i > 0 && { borderTopWidth: 1, borderTopColor: c.line }]}>
                  <Pressable onPress={() => setEd({ day: d, to: d, kg: String(kg) })} style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }} accessibilityRole="button" accessibilityLabel={`Edit ${d}`}>
                    <Text style={s.lDate}>{fmtDay(d)}</Text>
                    <Text style={s.lKg}>{`${kg} kg`}</Text>
                  </Pressable>
                  <Pressable onPress={() => del(d)} hitSlop={8} style={{ paddingLeft: 14 }} accessibilityRole="button" accessibilityLabel={`Delete ${d}`}><Icon d={P.trash} size={18} color={c.red} /></Pressable>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
      <Modal visible={!!ed} transparent animationType="fade" onRequestClose={() => setEd(null)} statusBarTranslucent>
        <KbView style={s.lWrap}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setEd(null)} accessibilityLabel="Close" />
          {ed && (
            <View style={s.lBox}>
              <Text style={s.cardT}>Edit weigh-in</Text>
              <Pressable onPress={() => setCal(true)} style={s.lDateBtn} accessibilityRole="button" accessibilityLabel="Choose the date">
                <Icon d={P.calendar} size={16} color={c.limeText} sw={2.2} /><Text style={s.lDateT}>{fmtDay(ed.to)}</Text>
              </Pressable>
              <View style={s.lKgBox}>
                <TextInput style={s.lKgIn} value={ed.kg} onChangeText={(v) => setEd({ ...ed, kg: v })} keyboardType="decimal-pad" maxLength={6} selectTextOnFocus selectionColor={c.lime} accessibilityLabel="Weight in kilograms" />
                <Text style={s.lUnit}>kg</Text>
              </View>
              <Pressable onPress={save} disabled={!ok} style={[s.lCta, !ok && { opacity: 0.35 }]} accessibilityRole="button"><Text style={s.lCtaT}>Save</Text></Pressable>
            </View>
          )}
          <Calendar visible={cal} selected={ed?.to ?? dayKey()} marks={new Set(Object.keys(state.weights))} title="Date of the weigh-in" onPick={(k) => setEd((e) => e && { ...e, to: k })} onClose={() => setCal(false)} />
        </KbView>
      </Modal>
    </Modal>
  );
}

/** Stats: this week's calories, macros and steps, plus weight over time. */
export function Stats({ onLogWeight }: { onLogWeight: () => void }) {
  const { state } = useStore();
  const [logs, setLogs] = useState(false);
  const t = targets(state.profile!);
  const days = useMemo(() => weekDays(), []);
  const today = dayKey();
  const [range, setRange] = useState(1);

  const per = days.map((d) => {
    const es = state.entries.filter((e) => e.day === d.key);
    return { kcal: sum(es, 'kcal'), p: sum(es, 'p'), c: sum(es, 'c'), f: sum(es, 'f'), n: es.length };
  });
  const iToday = days.findIndex((d) => d.isToday);
  const kT = per[iToday]?.kcal ?? 0;
  const left = t.kcal - kT;
  const elapsed = days.map((d, i) => d.key <= today && per[i].n > 0);
  const diff = per.reduce((a, x, i) => a + (elapsed[i] ? t.kcal - x.kcal : 0), 0);

  // macro shares, by energy
  const share = (x: { p: number; c: number; f: number }) => {
    const e = x.f * 9 + x.c * 4 + x.p * 4;
    return e > 0 ? { f: (x.f * 9) / e, c: (x.c * 4) / e, p: (x.p * 4) / e } : null;
  };
  const tot = per.reduce((a, x) => ({ p: a.p + x.p, c: a.c + x.c, f: a.f + x.f }), { p: 0, c: 0, f: 0 });
  const wk = share(tot);
  const shares = per.map(share);
  const used = shares.filter((x): x is NonNullable<typeof x> => !!x);
  const avg = used.length ? { f: used.reduce((a, x) => a + x.f, 0) / used.length, c: used.reduce((a, x) => a + x.c, 0) / used.length, p: used.reduce((a, x) => a + x.p, 0) / used.length } : null;
  const pc = (v?: number) => (v == null ? '—' : `${Math.round(v * 100)}%`);

  // steps
  const steps = useSteps(days.map((d) => d.key), state.settings.fit, state.settings.stepSource);
  const goal = state.settings.stepGoal;
  const sv = steps ?? days.map(() => 0);
  const stepsToday = iToday >= 0 ? sv[iToday] : 0;
  const stepsTotal = sv.reduce((a, b) => a + b, 0);
  const stepDays = sv.filter((x, i) => x > 0 && days[i].key <= today).length;

  // weight
  const all = useMemo(() => {
    const e = Object.entries(state.weights).sort((a, b) => (a[0] < b[0] ? -1 : 1));
    return e.length ? e : ([[today, state.profile!.weightKg]] as [string, number][]);
  }, [state.weights, state.profile, today]);
  const n = RANGES[range][2];
  const pts = all.filter(([k]) => n === Infinity || k >= addDays(today, -(n - 1)));
  const first = pts[0]?.[1], last = pts[pts.length - 1]?.[1];
  const change = pts.length > 1 ? last - first : null;

  return (
    <Screen>
      <Title>Stats</Title>

      <View style={[s.card, card]}>
        <CardHead title="Calories" />
        <View style={s.row}>
          <Gauge pct={kT / t.kcal} color={left < 0 ? c.orange : c.lime} big={fmt(Math.abs(left))} small={left >= 0 ? 'under' : 'over'} foot={`${fmt(kT)} cals`} />
          <DayBars days={days} values={per.map((x) => x.kcal)} goal={t.kcal} done={per.map((x, i) => elapsed[i] && x.kcal <= t.kcal)} over={(i) => per[i].kcal > t.kcal} />
        </View>
        <Text style={s.note}>
          {elapsed.some(Boolean) ? <><Text style={s.noteB}>{fmt(Math.abs(diff))} calories</Text>{` ${diff >= 0 ? 'under' : 'over'} budget for week`}</> : 'Log meals to see your week against your budget'}
        </Text>
      </View>

      <View style={[s.card, card]}>
        <CardHead title="Macronutrients" />
        <View style={s.row}>
          <View style={{ width: 136 }}>
            <Svg width={96} height={96} viewBox="-48 -48 96 96" style={{ alignSelf: 'center' }}>
              {!wk ? <Circle r={46} fill={c.line} stroke={OUT} strokeWidth={1.5} /> : (
                (() => {
                  const segs = [[wk.f, FAT], [wk.c, CARB], [wk.p, PROT]] as const;
                  const nz = segs.filter((x) => x[0] > 0.0001);
                  if (nz.length === 1) return <Circle r={46} fill={nz[0][1]} />;
                  let a = 0;
                  return nz.map(([v, col], i) => {
                    const a1 = a + v * 360;
                    const [x0, y0] = polar(0, 0, 46, a), [x1, y1] = polar(0, 0, 46, a1);
                    const d = `M0 0 L${x0} ${y0} A46 46 0 ${v > 0.5 ? 1 : 0} 1 ${x1} ${y1} Z`;
                    a = a1;
                    return <Path key={i} d={d} fill={col} />;
                  });
                })()
              )}
              {wk && <Circle r={46} fill="none" stroke={OUT} strokeWidth={1.5} />}
            </Svg>
            <View style={{ marginTop: 12, gap: 4 }}>
              {([['Fat', FAT, wk?.f], ['Carbs', CARB, wk?.c], ['Protein', PROT, wk?.p]] as const).map(([l, col, v]) => (
                <View key={l} style={s.legend}>
                  <View style={[s.dot, { backgroundColor: col }]} />
                  <Text style={s.legL}>{l}</Text>
                  <Text style={s.legV}>{pc(v)}</Text>
                </View>
              ))}
            </View>
          </View>
          <View style={s.bars}>
            {days.map((d, i) => {
              const x = shares[i];
              return (
                <View key={d.key} style={s.barCol}>
                  <View style={[s.track, { height: BAR_H - 40, justifyContent: 'flex-start' }]}>
                    {x && (
                      <>
                        <View style={{ flex: x.f, backgroundColor: FAT }} />
                        <View style={{ flex: x.c, backgroundColor: CARB }} />
                        <View style={{ flex: x.p, backgroundColor: PROT }} />
                      </>
                    )}
                  </View>
                  <Text style={[s.barL, d.isToday && { color: c.ink, fontFamily: f.bold }]}>{d.letter}</Text>
                </View>
              );
            })}
          </View>
        </View>
        <View style={s.avgRow}>
          <Text style={s.avgL}>Average</Text>
          {([[avg?.f, FAT], [avg?.c, CARB], [avg?.p, PROT]] as const).map(([v, col], i) => (
            <View key={i} style={[s.chip, { backgroundColor: col + '33' }]}><Text style={[s.chipT, { color: c.ink }]}>{pc(v)}</Text></View>
          ))}
        </View>
      </View>

      <View style={[s.card, card]}>
        <CardHead title="Steps" />
        {state.settings.fit ? (
          <>
            <View style={s.row}>
              <Gauge pct={stepsToday / goal} color={c.orange} big={fmt(stepsToday)} small="steps" foot={`goal ${fmt(goal)}`} />
              <DayBars days={days} values={sv} goal={goal} done={sv.map((x, i) => x >= goal && days[i].key <= today)} />
            </View>
            <Text style={s.note}><Text style={s.noteB}>{fmt(stepsTotal)} steps</Text> this week{stepDays > 0 ? ` · ${fmt(stepsTotal / stepDays)} a day` : ''}</Text>
          </>
        ) : (
          <Text style={s.empty}>Turn on “Sync steps” in Profile to see your steps here.</Text>
        )}
      </View>

      <View style={[s.card, card]}>
        <CardHead
          title="Weight"
          right={(
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Pressable onPress={() => setLogs(true)} style={s.logsBtn} accessibilityRole="button" accessibilityLabel="Weight logs"><Icon d={P.list} size={15} sw={2.4} color={c.ink} /><Text style={s.logsT}>Logs</Text></Pressable>
              <Pressable onPress={onLogWeight} style={s.plus} accessibilityRole="button" accessibilityLabel="Log weight"><Icon d={P.plus} size={18} sw={2.8} color={c.lime} /></Pressable>
            </View>
          )}
        />
        <View style={s.wRow}>
          <Text style={s.wBig}>{last != null ? last : '—'}<Text style={s.wUnit}> kg</Text></Text>
          {change != null && <Text style={[s.wDelta, { color: change <= 0 ? c.limeText : c.orange }]}>{change > 0 ? '+' : ''}{change.toFixed(1)} kg · {RANGES[range][1].toLowerCase()}</Text>}
        </View>
        <WeightChart pts={pts} goal={state.profile!.goalKg} />
        <View style={s.ranges}>
          {RANGES.map(([k], i) => (
            <Pressable key={k} onPress={() => setRange(i)} style={[s.range, range === i && { backgroundColor: c.btn }]} accessibilityRole="button" accessibilityLabel={RANGES[i][1]}>
              <Text style={[s.rangeT, range === i && { color: c.lime }]}>{k}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={s.rangeName}>{RANGES[range][1]} · dashed line = goal {state.profile!.goalKg} kg</Text>
      </View>
      <WeightLogs visible={logs} onClose={() => setLogs(false)} />
    </Screen>
  );
}

const mkStyles = () => StyleSheet.create({
  logsBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, borderRadius: 17, paddingHorizontal: 12, backgroundColor: c.page, borderWidth: 1, borderColor: c.line },
  logsT: { fontFamily: f.bold, fontSize: 13, color: c.ink },
  lWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', paddingHorizontal: 20 },
  lBox: { backgroundColor: c.card, borderRadius: 28, padding: 18, gap: 10, borderWidth: 1, borderColor: c.line },
  lHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  lRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13 },
  lDate: { flex: 1, fontFamily: f.medium, fontSize: 15, color: c.ink },
  lKg: { fontFamily: f.medium, fontSize: 15, color: c.ink },
  lDateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, alignSelf: 'center', backgroundColor: c.tint, borderRadius: 20, paddingHorizontal: 16, height: 38 },
  lDateT: { fontFamily: f.bold, fontSize: 14, color: c.limeText },
  lKgBox: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', backgroundColor: c.page, borderRadius: 22, paddingVertical: 8, gap: 6 },
  lKgIn: { fontFamily: f.extra, fontSize: 34, color: c.ink, minWidth: 100, textAlign: 'right', paddingVertical: 0 },
  lUnit: { fontFamily: f.bold, fontSize: 16, color: c.muted },
  lCta: { height: 50, borderRadius: 25, backgroundColor: c.btn, alignItems: 'center', justifyContent: 'center' },
  lCtaT: { fontFamily: f.bold, fontSize: 16, color: c.lime },
  card: { marginHorizontal: 10, marginBottom: 8, borderRadius: 26, padding: 16 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  cardT: { fontFamily: f.extra, fontSize: 18, color: c.ink, letterSpacing: -0.3 },
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  gaugeC: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  gaugeBig: { fontFamily: f.extra, fontSize: 24, color: c.ink, letterSpacing: -0.6 },
  gaugeSmall: { fontFamily: f.semi, fontSize: 13, color: c.muted },
  gaugeFoot: { fontFamily: f.bold, fontSize: 14, color: c.ink, marginTop: 6 },
  bars: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', marginLeft: 8 },
  barCol: { alignItems: 'center', width: 26 },
  track: { width: 22, height: BAR_H, borderRadius: 11, backgroundColor: c.page, justifyContent: 'flex-end', overflow: 'hidden', borderWidth: 1.5, borderColor: OUT },
  fill: { width: '100%', borderRadius: 11, alignItems: 'center', justifyContent: 'flex-end' },
  barL: { fontFamily: f.semi, fontSize: 12.5, color: c.soft, marginTop: 8 },
  note: { fontFamily: f.regular, fontSize: 14, color: c.ink, textAlign: 'center', marginTop: 18 },
  noteB: { fontFamily: f.extra },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legL: { flex: 1, fontFamily: f.medium, fontSize: 13, color: c.ink },
  legV: { fontFamily: f.extra, fontSize: 13, color: c.ink },
  avgRow: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', marginTop: 10 },
  avgL: { fontFamily: f.medium, fontSize: 13, color: c.muted, marginRight: 4 },
  chip: { borderRadius: 18, paddingHorizontal: 16, paddingVertical: 9 },
  chipT: { fontFamily: f.extra, fontSize: 14 },
  empty: { fontFamily: f.regular, fontSize: 14, color: c.muted, lineHeight: 21 },
  plus: { width: 34, height: 34, borderRadius: 17, backgroundColor: c.btn, alignItems: 'center', justifyContent: 'center' },
  wRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap' },
  wBig: { fontFamily: f.extra, fontSize: 30, color: c.ink, letterSpacing: -0.8 },
  wUnit: { fontFamily: f.semi, fontSize: 15, color: c.muted },
  wDelta: { fontFamily: f.bold, fontSize: 13 },
  ranges: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  range: { backgroundColor: c.page, borderRadius: 16, paddingHorizontal: 13, paddingVertical: 8 },
  rangeT: { fontFamily: f.bold, fontSize: 12.5, color: c.ink },
  rangeName: { fontFamily: f.medium, fontSize: 12, color: c.muted, textAlign: 'center', marginTop: 10 },
});
let s = mkStyles();
onTheme(() => { s = mkStyles(); });
