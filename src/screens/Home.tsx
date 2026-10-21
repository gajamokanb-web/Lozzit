import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { askConfirm } from '../dialog';
import { Text, tr } from '../i18n';
import Svg, { Circle, Path } from 'react-native-svg';
import { c, f, onTheme } from '../theme';
import { addDays, entryBase, fmt, fmtDay, MEALS, parseKey, scaleEntry, sum, targets, weekDays, type Entry, type MealKey } from '../domain';
import { useStore } from '../store';
import { FoodIcon } from '../foodIcons';
import { FactorModal } from './Factor';
import { BlockMenu, MealPick, MealSummary } from './BlockMenu';
import { Calendar } from './Calendar';
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
          <Pressable key={d.key} onPress={() => onSelect(d.key)} style={[s.day, on && { backgroundColor: c.btn }]} accessibilityLabel={`Day ${d.date}`}>
            <Text style={[s.dayL, on && { color: c.lime }]}>{d.letter}</Text>
            <Text style={[s.dayN, on && { color: '#fff' }]}>{d.date}</Text>
            <View style={[s.todayDot, { opacity: d.isToday && !on ? 1 : 0 }]} />
          </Pressable>
        );
      })}
    </View>
  );
}

function MealBlock({ label, entries, icons, open, onToggle, onAdd, onMenu, onEdit }: { label: string; entries: Entry[]; icons: Record<string, string | undefined>; open: boolean; onToggle: () => void; onAdd: () => void; onMenu: (y: number) => void; onEdit: (id: string) => void }) {
  const dots = React.useRef<View>(null);
  const total = sum(entries, 'kcal');
  return (
    <View style={s.block}>
      <Pressable onPress={onToggle} style={s.blockHead} accessibilityRole="button" accessibilityLabel={`${label}, ${open ? 'collapse' : 'expand'}`}>
        <Icon d={open ? P.chevDown : P.next} size={20} color={c.muted} />
        <View style={{ flex: 1 }}>
          <Text style={s.blockName}>{label}</Text>
        </View>
        <Text style={s.blockKcal}>{fmt(total)} kcal</Text>
        <Pressable ref={dots} onPress={() => dots.current?.measureInWindow((_x, y, _w, h) => onMenu(y + h))} style={s.dots} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Options ${label}`}>
          <Icon d={P.more} size={22} color={c.muted} sw={3} />
        </Pressable>
      </Pressable>
      {open && (
        <>
          {entries.map((e) => {
            const { base, qty } = entryBase(e);
            const amount = base.unit === 'srv' ? (qty === 1 ? '1 serving' : `${qty} servings`) : `${qty} ${base.unit}`;
            const macros = [amount, e.brand].filter(Boolean).join(' · ');
            return (
              <Pressable key={e.id} onPress={() => onEdit(e.id)} style={s.item} accessibilityLabel={`Edit ${e.name}`}>
                <FoodIcon name={e.name} icon={e.fk ? icons[e.fk] : undefined} size={32} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={s.itemName} numberOfLines={1}>{e.name}</Text>
                  {macros ? <Text style={s.itemSub}>{macros}</Text> : null}
                </View>
                <Text style={s.itemKcal}>{fmt(e.kcal)}</Text>
              </Pressable>
            );
          })}
          <View style={s.btnRow}>
            <Pressable onPress={onAdd} style={s.addBtn} accessibilityRole="button" accessibilityLabel={`Add food to ${label}`}>
              <Text style={s.addText}>Add Food</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

export function Home({ selected, onSelect, onOpenCalendar, onAdd, onEdit, onGoSettings }: {
  selected: string;
  onSelect: (k: string) => void;
  onOpenCalendar: () => void;
  onAdd: (meal: MealKey, day: string, scan?: boolean) => void;
  onEdit: (entry: Entry) => void;
  onGoSettings: () => void;
}) {
  const { state, setWater, updateEntry, addEntry, removeEntry } = useStore();
  const [factory, setFactory] = useState<{ label: string; entries: Entry[] } | null>(null);
  type Blk = { key: MealKey; label: string; entries: Entry[] };
  const [menu, setMenu] = useState<{ blk: Blk; y: number } | null>(null);
  const [summary, setSummary] = useState<Blk | null>(null);
  const [copyBlk, setCopyBlk] = useState<Blk | null>(null);
  const [copyDay, setCopyDay] = useState<string | null>(null);
  const copyPicked = React.useRef(false);
  const icons = useMemo(() => Object.fromEntries(Object.values(state.foods).map((x) => [x.key, x.icon])), [state.foods]);
  const profile = state.profile!;
  const t = useMemo(() => targets(profile), [profile]);
  const [closed, setClosed] = useState<Partial<Record<MealKey, boolean>>>({});

  const days = useMemo(() => weekDays(parseKey(selected)), [selected]);
  const steps = useSteps(days.map((d) => d.key), state.settings.fit, state.settings.stepSource);
  const selIdx = days.findIndex((d) => d.key === selected);
  const maxSteps = steps ? Math.max(1, ...steps) : 1;

  const entries = state.entries.filter((e) => e.day === selected);
  const confirmClear = (b: { label: string; entries: Entry[] }) => {
    askConfirm({ title: 'Clear Meal Entry', message: tr(`Remove all ${b.entries.length} items from ${b.label}?`), confirmText: tr('Clear Meal Entry'), danger: true })
      .then((ok) => { if (ok) b.entries.forEach((e) => removeEntry(e.id)); });
  };
  const eaten = sum(entries, 'kcal');
  const left = t.kcal - eaten;
  const pct = Math.min(eaten / t.kcal, 1);
  const R = 58, C = 2 * Math.PI * R;
  const count = state.water[selected] ?? 0;
  const litres = Number((count * DROP_L).toFixed(2));
  const setCount = (n: number) => setWater(selected, Math.max(0, Math.min(40, n)));

  const st = state.settings;
  type Sub = { name: string; v: number; goal: number };
  const macros: { name: string; v: number; goal: number; subs: Sub[] }[] = [
    { name: 'Protein', v: sum(entries, 'p'), goal: t.protein, subs: [] },
    { name: 'Carbs', v: sum(entries, 'c'), goal: t.carbs, subs: st.showSugar ? [{ name: 'Sugar', v: sum(entries, 'sg'), goal: t.sugar }] : [] },
    {
      name: 'Fat', v: sum(entries, 'f'), goal: t.fat,
      subs: [
        ...(st.showSalt ? [{ name: 'Salt', v: sum(entries, 'sl'), goal: t.salt }] : []),
        ...(st.showFiber ? [{ name: 'Fiber', v: sum(entries, 'fi'), goal: t.fiber }] : []),
        ...(st.showSat ? [{ name: 'Sat. fat', v: sum(entries, 'sf'), goal: t.sat }] : []),
      ],
    },
  ];
  const nSubs = macros.reduce((a, m) => a + m.subs.length, 0);
  const shown = MEALS.filter((m) => st.meals.includes(m.key) || state.entries.some((e) => e.day === selected && e.meal === m.key));

  return (
    <Screen>
      <DateBar selected={selected} onSelect={onSelect} onOpen={onOpenCalendar} />
      <WeekStrip days={days} selected={selected} onSelect={onSelect} />

      <View style={s.hero}>
        <View style={s.heroBlob} />
        <View style={{ width: 136, height: 136 }}>
          <Svg width={136} height={136} viewBox="0 0 136 136">
            <Circle cx={68} cy={68} r={R} fill="none" stroke={c.onLime} strokeOpacity={0.13} strokeWidth={16} />
            {pct > 0 && (
              <Circle cx={68} cy={68} r={R} fill="none" stroke={c.onLime} strokeWidth={16} strokeLinecap="round" strokeDasharray={`${C * pct} ${C}`} transform="rotate(-90 68 68)" />
            )}
          </Svg>
          <View style={s.ringCenter}>
            <Text style={s.ringBig}>{fmt(Math.abs(left))}</Text>
            <Text style={s.ringSmall}>{left >= 0 ? 'kcal left' : 'kcal over'}</Text>
          </View>
        </View>
        <View style={{ flex: 1, gap: nSubs > 1 ? 10 : 15 }}>
          {macros.map((m) => (
            <View key={m.name}>
              <View style={s.macroTop}>
                <Text style={s.macroName}>{m.name}</Text>
                <Text style={s.macroVal}>{Math.round(m.v)}<Text style={s.macroGoal}>/{m.goal}g</Text></Text>
              </View>
              <View style={s.track}><View style={[s.fill, { width: `${Math.min(m.v / m.goal, 1) * 100}%` }]} /></View>
              {m.subs.map((x) => (
                <View key={x.name} style={{ marginTop: 6 }}>
                  <View style={s.macroTop}>
                    <Text style={s.subName}>{x.name}</Text>
                    <Text style={s.subVal}>{Math.round(x.v * 10) / 10}<Text style={s.macroGoal}>/{x.goal}g</Text></Text>
                  </View>
                  <View style={s.trackS}><View style={[s.fillS, { width: `${Math.min(x.v / x.goal, 1) * 100}%` }]} /></View>
                </View>
              ))}
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
            <Text style={s.connect}>Connect steps</Text>
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
            <View style={{ flex: 1 }} />
            <Pressable onPress={() => setCount(count - 1)} style={s.pm} hitSlop={6} accessibilityLabel="Remove 250 mL"><Icon d={P.minus} size={14} sw={2.8} color={c.blue} /></Pressable>
            <Pressable onPress={() => setCount(count + 1)} style={[s.pm, { backgroundColor: c.blue }]} hitSlop={6} accessibilityLabel="Add 250 mL"><Icon d={P.plus} size={14} sw={2.8} color="#fff" /></Pressable>
          </View>
          <Text style={s.big} numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.1}>{litres}<Text style={s.bigUnit}> L</Text></Text>
          <View style={s.drops}>
            {Array.from({ length: 10 }, (_, i) => (
              <Svg key={i} width={11.5} height={15} viewBox="5 2.5 14 19.5"><Path d={P.drop[0]} fill={i < count ? c.blue : c.blueSoft} /></Svg>
            ))}
          </View>
        </View>
      </View>

      <View style={{ marginTop: 10, gap: 8 }}>
        {shown.map((m) => (
          <MealBlock
            key={m.key}
            label={m.label}
            icons={icons}
            entries={entries.filter((e) => e.meal === m.key)}
            onMenu={(y) => setMenu({ blk: { key: m.key, label: m.label, entries: entries.filter((e) => e.meal === m.key) }, y })}
            open={!closed[m.key]}
            onToggle={() => setClosed((x) => ({ ...x, [m.key]: !x[m.key] }))}
            onAdd={() => onAdd(m.key, selected)}
            onEdit={(id) => onEdit(entries.find((x) => x.id === id)!)}
          />
        ))}
      </View>
      <BlockMenu
        anchorY={menu ? menu.y : null}
        onClose={() => setMenu(null)}
        items={menu ? [
          { label: 'Clear Meal Entry', icon: P.trash, danger: true, onPress: () => confirmClear(menu.blk) },
          { label: 'Factor', icon: P.factor, onPress: () => setFactory({ label: menu.blk.label, entries: menu.blk.entries }) },
          { label: 'Copy', icon: P.copy, onPress: () => setCopyBlk(menu.blk) },
          { label: 'Scan It', icon: P.scan, onPress: () => onAdd(menu.blk.key, selected, true) },
          { label: 'Meal Summary', icon: P.stats, onPress: () => setSummary(menu.blk) },
        ].filter((it) => menu.blk.entries.length > 0 || it.label === 'Scan It') : []}
      />
      <MealSummary visible={!!summary} label={summary?.label ?? ''} entries={summary?.entries ?? []} budget={t.kcal} onClose={() => setSummary(null)} />
      <Calendar
        visible={!!copyBlk && !copyDay}
        selected={selected}
        marks={new Set(state.entries.map((e) => e.day))}
        title={copyBlk ? `Copy ${copyBlk.label} to…` : undefined}
        onPick={(k) => { copyPicked.current = true; setCopyDay(k); }}
        onClose={() => { if (copyPicked.current) copyPicked.current = false; else setCopyBlk(null); }}
      />
      <MealPick
        visible={!!copyBlk && !!copyDay}
        title="Copy into which meal?"
        meals={shown.map((m) => ({ key: m.key, label: m.label }))}
        initial={copyBlk?.key}
        onClose={() => { setCopyBlk(null); setCopyDay(null); }}
        onPick={(meal) => {
          if (copyBlk && copyDay) { copyBlk.entries.forEach(({ id: _id, ...e }) => addEntry({ ...e, day: copyDay, meal })); onSelect(copyDay); }
          setCopyBlk(null); setCopyDay(null);
        }}
      />
      <FactorModal
        visible={!!factory}
        title={`Factor · ${factory?.label ?? ''}`}
        confirm="Apply"
        kcal={factory ? sum(factory.entries, 'kcal') : 0}
        onClose={() => setFactory(null)}
        onApply={(k) => { factory?.entries.forEach((e) => updateEntry(e.id, scaleEntry(e, k))); setFactory(null); }}
      />
    </Screen>
  );
}

const mkStyles = () => StyleSheet.create({
  dateBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 46 },
  arrow: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  dateBtn: { paddingVertical: 8, paddingHorizontal: 8 },
  dateText: { fontFamily: f.extra, fontSize: 20, color: c.ink, letterSpacing: -0.4, minWidth: 130, textAlign: 'center' },

  week: { flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: 10, marginTop: 8 },
  day: { width: 45, height: 64, borderRadius: 22, alignItems: 'center', justifyContent: 'center', gap: 4 },
  dayL: { fontFamily: f.semi, fontSize: 12, color: c.soft },
  dayN: { fontFamily: f.bold, fontSize: 16, color: c.ink },
  todayDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: c.lime },

  hero: { marginHorizontal: 10, marginTop: 8, minHeight: 172, paddingVertical: 18, borderRadius: 30, backgroundColor: c.lime, paddingLeft: 18, paddingRight: 20, flexDirection: 'row', alignItems: 'center', gap: 20, overflow: 'hidden' },
  heroBlob: { position: 'absolute', right: -60, top: -80, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(255,255,255,0.16)' },
  ringCenter: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  ringBig: { fontFamily: f.extra, fontSize: 27, color: c.onLime, letterSpacing: -1 },
  ringSmall: { fontFamily: f.semi, fontSize: 12, color: c.onLime, opacity: 0.72, marginTop: 3 },
  macroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 7 },
  macroName: { fontFamily: f.semi, fontSize: 12.5, color: c.onLime, opacity: 0.78 },
  macroVal: { fontFamily: f.extra, fontSize: 12.5, color: c.onLime },
  macroGoal: { fontFamily: f.semi, opacity: 0.6 },
  subName: { fontFamily: f.semi, fontSize: 11, color: c.onLime, opacity: 0.7 },
  subVal: { fontFamily: f.bold, fontSize: 11, color: c.onLime },
  trackS: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.5)', overflow: 'hidden' },
  fillS: { height: 4, borderRadius: 2, backgroundColor: c.onLime, opacity: 0.75 },
  track: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.5)', overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: c.onLime },

  tiles: { flexDirection: 'row', gap: 8, marginHorizontal: 10, marginTop: 8 },
  tile: { ...card, flex: 1, height: 142, borderRadius: 26, padding: 14 },
  tileRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  ico: { width: 32, height: 32, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  tileLabel: { fontFamily: f.semi, fontSize: 13, color: c.muted },
  big: { fontFamily: f.extra, fontSize: 23, color: c.ink, letterSpacing: -0.7, lineHeight: 32, paddingVertical: 2, marginTop: 8, marginBottom: 8 },
  bigUnit: { fontFamily: f.semi, fontSize: 13, color: c.muted, letterSpacing: 0 },
  connect: { fontFamily: f.bold, fontSize: 13, color: c.orange, lineHeight: 32, marginTop: 8, marginBottom: 8 },
  bars: { height: 28, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  pm: { width: 26, height: 26, borderRadius: 13, marginLeft: 4, backgroundColor: c.blueTint, alignItems: 'center', justifyContent: 'center' },
  drops: { height: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  block: { ...card, marginHorizontal: 10, borderRadius: 22, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10 },
  dots: { width: 32, height: 36, alignItems: 'center', justifyContent: 'center' },
  blockHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  blockName: { fontFamily: f.bold, fontSize: 16, color: c.ink },
  blockKcal: { fontFamily: f.bold, fontSize: 14, color: c.ink, marginRight: -4 },
  blockSub: { fontFamily: f.medium, fontSize: 13, color: c.muted, marginTop: 2 },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, marginTop: 2 },
  itemName: { fontFamily: f.semi, fontSize: 14, color: c.ink },
  itemSub: { fontFamily: f.regular, fontSize: 12, color: c.muted, marginTop: 1 },
  itemKcal: { fontFamily: f.regular, fontSize: 14, color: c.ink, marginLeft: 10 },
  btnRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 8 },
  addBtn: { backgroundColor: c.tint, borderRadius: 22, paddingVertical: 9, paddingHorizontal: 24 },
  addText: { fontFamily: f.bold, fontSize: 15, color: c.limeText },
});
let s = mkStyles();
onTheme(() => { s = mkStyles(); });
