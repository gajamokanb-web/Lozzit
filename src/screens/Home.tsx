import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { c, f } from '../theme';
import { addDays, dayKey, fmt, fmtDay, MEALS, parseKey, sum, targets, weekDays, type Entry, type MealKey } from '../domain';
import { useStore } from '../store';
import { useSteps } from '../steps';
import { card, Icon, P, Screen } from '../ui';

const DROP_L = 0.25; // litres per drop (250 mL)

function DateBar({ selected, onSelect, onOpen }: { selected: string; onSelect: (k: string) => void; onOpen: () => void }) {
  return (
    <View style={s.dateBar}>
      <Pressable onPress={() => onSelect(addDays(selected, -1))} style={s.arrow} hitSlop={8} accessibilityLabel="Previous day">
        <Icon d={P.back} size={22} />
      </Pressable>
      <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel="Open calendar" style={s.dateBtn}>
        <Text style={s.dateText}>{fmtDay(selected)}</Text>
      </Pressable>
      <Pressable onPress={() => onSelect(addDays(selected, 1))} style={s.arrow} hitSlop={8} accessibilityLabel="Next day">
        <Icon d={P.next} size={22} />
      </Pressable>
    </View>
  );
}

function WeekStrip({ days, selected, onSelect }: { days: ReturnType<typeof weekDays>; selected: string; onSelect: (k: string) => void }) {
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

function MealBlock({ label, entries, open, onToggle, onAdd }: { label: string; entries: Entry[]; open: boolean; onToggle: () => void; onAdd: () => void }) {
  const total = sum(entries, 'kcal');
  return (
    <View style={s.block}>
      <Pressable onPress={onToggle} style={s.blockHead} accessibilityRole="button" accessibilityLabel={`${label}, ${open ? 'collapse' : 'expand'}`}>
        <Icon d={open ? P.chevUp : P.chevDown} size={20} color={c.muted} />
        <View style={{ flex: 1 }}>
          <Text style={s.blockName}>{label}</Text>
          <Text style={s.blockSub}>{fmt(total)} calories logged</Text>
        </View>
      </Pressable>
      {open && (
        <>
          {entries.map((e) => {
            const macros = [e.p && `P ${Math.round(e.p)}`, e.c && `C ${Math.round(e.c)}`, e.f && `F ${Math.round(e.f)}`].filter(Boolean).join(' · ');
            return (
              <Pressable key={e.id} onPress={onAdd} style={s.item}>
                <View style={{ flex: 1 }}>
                  <Text style={s.itemName} numberOfLines={1}>{e.name}</Text>
                  {macros ? <Text style={s.itemSub}>{macros}</Text> : null}
                </View>
                <Text style={s.itemKcal}>{fmt(e.kcal)}</Text>
              </Pressable>
            );
          })}
          <Pressable onPress={onAdd} style={s.addBtn} accessibilityRole="button" accessibilityLabel={`Add food to ${label}`}>
            <Text style={s.addText}>Add Food</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

export function Home({ selected, onSelect, onOpenCalendar, onAdd, onGoSettings }: {
  selected: string;
  onSelect: (k: string) => void;
  onOpenCalendar: () => void;
  onAdd: (meal: MealKey, day: string) => void;
  onGoSettings: () => void;
}) {
  const { state, setWater } = useStore();
  const profile = state.profile!;
  const t = useMemo(() => targets(profile), [profile]);
  const [closed, setClosed] = useState<Partial<Record<MealKey, boolean>>>({});

  const days = useMemo(() => weekDays(parseKey(selected)), [selected]);
  const steps = useSteps(days.map((d) => d.key), state.settings.fit);
  const selIdx = days.findIndex((d) => d.key === selected);
  const maxSteps = steps ? Math.max(1, ...steps) : 1;

  const entries = state.entries.filter((e) => e.day === selected);
  const eaten = sum(entries, 'kcal');
  const left = t.kcal - eaten;
  const pct = Math.min(eaten / t.kcal, 1);
  const R = 58, C = 2 * Math.PI * R;
  const count = state.water[selected] ?? 0;
  const litres = Number((count * DROP_L).toFixed(2));
  const setCount = (n: number) => setWater(selected, Math.max(0, Math.min(40, n)));

  const macros = [
    { name: 'Protein', v: sum(entries, 'p'), goal: t.protein },
    { name: 'Carbs', v: sum(entries, 'c'), goal: t.carbs },
    { name: 'Fat', v: sum(entries, 'f'), goal: t.fat },
  ];

  return (
    <Screen>
      <DateBar selected={selected} onSelect={onSelect} onOpen={onOpenCalendar} />
      <WeekStrip days={days} selected={selected} onSelect={onSelect} />

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
        <Pressable style={s.tile} onPress={state.settings.fit ? undefined : onGoSettings} accessibilityLabel="Steps">
          <View style={s.tileRow}>
            <View style={[s.ico, { backgroundColor: c.orangeTint }]}><Icon d={P.steps} size={18} color={c.orange} sw={2.2} /></View>
            <Text style={s.tileLabel}>Steps</Text>
          </View>
          {state.settings.fit ? (
            <Text style={s.big}>{steps && selIdx >= 0 ? fmt(steps[selIdx]) : '…'}</Text>
          ) : (
            <Text style={s.connect}>Connect Google Fit</Text>
          )}
          <View style={s.bars}>
            {days.map((d, i) => (
              <View
                key={d.key}
                style={{ width: 12, height: steps ? Math.max(4, 28 * (steps[i] / maxSteps)) : 11, borderRadius: 5, backgroundColor: steps && d.key === selected ? c.orange : steps ? c.orangeSoft : c.orangeTint }}
              />
            ))}
          </View>
        </Pressable>

        <View style={s.tile}>
          <View style={s.tileRow}>
            <View style={[s.ico, { backgroundColor: c.blueTint }]}><Icon d={P.drop} size={18} color={c.blue} fill={c.blue} sw={0} /></View>
            <Text style={s.tileLabel}>Water</Text>
          </View>
          <View style={s.waterRow}>
            <Text style={[s.big, { marginVertical: 0, flex: 1 }]}>{litres}<Text style={s.bigUnit}> L</Text></Text>
            <Pressable onPress={() => setCount(count - 1)} style={s.pm} hitSlop={6} accessibilityLabel="Remove 250 mL"><Icon d={P.minus} size={16} sw={2.6} color={c.blue} /></Pressable>
            <Pressable onPress={() => setCount(count + 1)} style={[s.pm, { backgroundColor: c.blue }]} hitSlop={6} accessibilityLabel="Add 250 mL"><Icon d={P.plus} size={16} sw={2.6} color="#fff" /></Pressable>
          </View>
          <View style={s.drops}>
            {Array.from({ length: 10 }, (_, i) => (
              <Svg key={i} width={11.5} height={15} viewBox="5 2.5 14 19.5"><Path d={P.drop[0]} fill={i < count ? c.blue : c.blueSoft} /></Svg>
            ))}
          </View>
        </View>
      </View>

      <View style={{ marginTop: 18, gap: 12 }}>
        {MEALS.map((m) => (
          <MealBlock
            key={m.key}
            label={m.label}
            entries={entries.filter((e) => e.meal === m.key)}
            open={!closed[m.key]}
            onToggle={() => setClosed((x) => ({ ...x, [m.key]: !x[m.key] }))}
            onAdd={() => onAdd(m.key, selected)}
          />
        ))}
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  dateBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 46 },
  arrow: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  dateBtn: { paddingVertical: 8, paddingHorizontal: 8 },
  dateText: { fontFamily: f.extra, fontSize: 20, color: c.ink, letterSpacing: -0.4, minWidth: 130, textAlign: 'center' },

  week: { flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: 16, marginTop: 8 },
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
  connect: { fontFamily: f.bold, fontSize: 13, color: c.orange, lineHeight: 28, marginTop: 10, marginBottom: 9 },
  bars: { height: 28, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  waterRow: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 28, marginTop: 10, marginBottom: 9 },
  pm: { width: 28, height: 28, borderRadius: 14, backgroundColor: c.blueTint, alignItems: 'center', justifyContent: 'center' },
  drops: { height: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  block: { ...card, marginHorizontal: 20, borderRadius: 24, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14 },
  blockHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  blockName: { fontFamily: f.bold, fontSize: 17, color: c.ink },
  blockSub: { fontFamily: f.medium, fontSize: 13, color: c.muted, marginTop: 2 },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, marginTop: 4 },
  itemName: { fontFamily: f.semi, fontSize: 15, color: c.ink },
  itemSub: { fontFamily: f.regular, fontSize: 12.5, color: c.muted, marginTop: 2 },
  itemKcal: { fontFamily: f.bold, fontSize: 15, color: c.ink, marginLeft: 12 },
  addBtn: { alignSelf: 'flex-end', marginTop: 8, backgroundColor: c.tint, borderRadius: 24, paddingVertical: 12, paddingHorizontal: 24 },
  addText: { fontFamily: f.bold, fontSize: 15, color: c.limeText },
});
