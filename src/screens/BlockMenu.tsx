import React from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Text } from '../i18n';
import { c, f, onTheme } from '../theme';
import { EXTRAS, fmt, sum, type Entry } from '../domain';
import { card, Icon, P } from '../ui';

export type MenuItem = { label: string; icon: string[]; danger?: boolean; onPress: () => void };

/** Small popup list anchored under the "⋮" button of a meal block. */
export function BlockMenu({ anchorY, items, onClose }: { anchorY: number | null; items: MenuItem[]; onClose: () => void }) {
  const { height } = useWindowDimensions();
  const est = items.length * 49 + 8;
  const y = anchorY ?? 0;
  const up = y + 8 + est > height - 24; // not enough room below the "⋮": open upwards
  const pos = up ? { bottom: Math.max(16, height - (y - 36) + 6) } : { top: Math.max(60, y + 8) };
  return (
    <Modal visible={anchorY != null} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close menu" />
      <View style={[s.menu, card, pos]}>
        {items.map((it, i) => (
          <Pressable key={it.label} onPress={() => { onClose(); it.onPress(); }} style={[s.row, i > 0 && { borderTopWidth: 1, borderTopColor: c.line }]} accessibilityRole="button" accessibilityLabel={it.label}>
            <Icon d={it.icon} size={19} color={it.danger ? c.red : c.ink} sw={2} />
            <Text style={[s.txt, it.danger && { color: c.red }]}>{it.label}</Text>
          </Pressable>
        ))}
      </View>
    </Modal>
  );
}

const PROT = '#6C63E0', CARB = '#5BAEDC', FAT = '#F6B26B';

/** Macro split of one meal block. */
export function MealSummary({ visible, label, entries, budget, onClose }: { visible: boolean; label: string; entries: Entry[]; budget: number; onClose: () => void }) {
  const kcal = sum(entries, 'kcal');
  const p = sum(entries, 'p'), cb = sum(entries, 'c'), fa = sum(entries, 'f');
  const parts = [
    { name: 'Protein', g: p, k: p * 4, col: PROT },
    { name: 'Carbs', g: cb, k: cb * 4, col: CARB },
    { name: 'Fat', g: fa, k: fa * 9, col: FAT },
  ];
  const tot = parts.reduce((a, x) => a + x.k, 0) || 1;
  const extras = EXTRAS.map((x) => ({ label: x.label, v: sum(entries, x.k) })).filter((x) => x.v > 0);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={s.wrap}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <View style={s.card}>
          <Text style={s.h}>{label}</Text>
          <Text style={s.big}>{fmt(kcal)}<Text style={s.unit}> kcal</Text></Text>
          <Text style={s.sub}>{`${entries.length} ${entries.length === 1 ? 'item' : 'items'}${budget > 0 ? ` · ${Math.round((kcal / budget) * 100)}% of your daily budget` : ''}`}</Text>
          <View style={s.bar}>
            {parts.map((x) => <View key={x.name} style={{ flex: Math.max(x.k, 0.0001), backgroundColor: x.col }} />)}
          </View>
          {parts.map((x) => (
            <View key={x.name} style={s.line}>
              <View style={[s.dot, { backgroundColor: x.col }]} />
              <Text style={s.name}>{x.name}</Text>
              <Text style={s.val}>{`${Math.round(x.g * 10) / 10} g`}</Text>
              <Text style={s.pct}>{`${Math.round((x.k / tot) * 100)}%`}</Text>
            </View>
          ))}
          {extras.length > 0 && <View style={s.sep} />}
          {extras.map((x) => (
            <View key={x.label} style={s.line}>
              <Text style={[s.name, { marginLeft: 20 }]}>{x.label}</Text>
              <Text style={s.val}>{`${Math.round(x.v * 10) / 10} g`}</Text>
              <Text style={s.pct} />
            </View>
          ))}
          <Pressable onPress={onClose} style={s.cta} accessibilityRole="button"><Text style={s.ctaT}>Done</Text></Pressable>
        </View>
      </View>
    </Modal>
  );
}

const mkStyles = () => StyleSheet.create({
  menu: { position: 'absolute', right: 20, minWidth: 210, borderRadius: 20, overflow: 'hidden', elevation: 12, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  txt: { fontFamily: f.semi, fontSize: 15, color: c.ink },
  wrap: { flex: 1, backgroundColor: 'rgba(21,32,15,0.45)', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: c.card, borderRadius: 28, padding: 22, gap: 10 },
  h: { fontFamily: f.extra, fontSize: 20, color: c.ink },
  big: { fontFamily: f.extra, fontSize: 36, color: c.ink, letterSpacing: -1 },
  unit: { fontFamily: f.bold, fontSize: 16, color: c.muted, letterSpacing: 0 },
  sub: { fontFamily: f.medium, fontSize: 13, color: c.muted, marginTop: -6 },
  bar: { flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden', backgroundColor: c.line, marginTop: 6, marginBottom: 4 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  name: { flex: 1, fontFamily: f.semi, fontSize: 15, color: c.ink },
  val: { fontFamily: f.bold, fontSize: 15, color: c.ink, minWidth: 70, textAlign: 'right' },
  pct: { fontFamily: f.semi, fontSize: 14, color: c.muted, minWidth: 44, textAlign: 'right' },
  sep: { height: 1, backgroundColor: c.line, marginVertical: 4 },
  cta: { height: 52, borderRadius: 26, backgroundColor: c.btn, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  ctaT: { fontFamily: f.bold, fontSize: 16, color: c.lime },
});
let s = mkStyles();
onTheme(() => { s = mkStyles(); });

/** Small chooser of the meal a copied block goes into. */
export function MealPick({ visible, title, meals, initial, onPick, onClose }: { visible: boolean; title: string; meals: { key: any; label: string }[]; initial?: string; onPick: (k: any) => void; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={mp.wrap}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <View style={mp.box}>
          <Text style={mp.title}>{title}</Text>
          {meals.map((m, i) => (
            <Pressable key={m.key} onPress={() => onPick(m.key)} style={[mp.row, i > 0 && { borderTopWidth: 1, borderTopColor: c.line }]} accessibilityRole="button" accessibilityLabel={m.label}>
              <Text style={[mp.txt, m.key === initial && { fontFamily: f.extra }]}>{m.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  );
}
const mkMp = () => StyleSheet.create({
  wrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', paddingHorizontal: 24 },
  box: { backgroundColor: c.card, borderRadius: 26, padding: 18, borderWidth: 1, borderColor: c.line },
  title: { fontFamily: f.extra, fontSize: 18, color: c.ink, marginBottom: 8 },
  row: { paddingVertical: 14 },
  txt: { fontFamily: f.semi, fontSize: 16, color: c.ink },
});
let mp = mkMp();
onTheme(() => { mp = mkMp(); });
