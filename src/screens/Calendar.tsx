import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Text, getLang } from '../i18n';
import { c, f, onTheme } from '../theme';
import { dayKey, MONTHS, parseKey } from '../domain';
import { Icon, P } from '../ui';

const pad = (n: number) => String(n).padStart(2, '0');

/** Month picker. `marks` = day keys that have something logged. */
export function Calendar({ visible, selected, marks, onPick, onClose, title }: { visible: boolean; selected: string; marks: Set<string>; onPick: (k: string) => void; onClose: () => void; title?: string }) {
  const sel = parseKey(selected);
  const [ym, setYm] = useState({ y: sel.getFullYear(), m: sel.getMonth() });
  useEffect(() => {
    if (visible) setYm({ y: sel.getFullYear(), m: sel.getMonth() });
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const today = dayKey();
  const first = new Date(ym.y, ym.m, 1);
  const lead = (first.getDay() + 6) % 7; // Monday first
  const count = new Date(ym.y, ym.m + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const move = (n: number) => { const d = new Date(ym.y, ym.m + n, 1); setYm({ y: d.getFullYear(), m: d.getMonth() }); };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={s.wrap}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close calendar" />
        <View style={s.card}>
          {title ? <Text style={s.title}>{title}</Text> : null}
          <View style={s.head}>
            <Pressable onPress={() => move(-1)} style={s.arrow} hitSlop={8} accessibilityLabel="Previous month"><Icon d={P.back} size={20} /></Pressable>
            <Text style={s.month}>{MONTHS[ym.m]} {ym.y}</Text>
            <Pressable onPress={() => move(1)} style={s.arrow} hitSlop={8} accessibilityLabel="Next month"><Icon d={P.next} size={20} /></Pressable>
          </View>
          <View style={s.row}>
            {(getLang() === 'fr' ? 'LMMJVSD' : 'MTWTFSS').split('').map((l, i) => <Text key={i} style={s.wd}>{l}</Text>)}
          </View>
          {Array.from({ length: cells.length / 7 }, (_, r) => (
            <View key={r} style={s.row}>
              {cells.slice(r * 7, r * 7 + 7).map((d, i) => {
                if (!d) return <View key={i} style={s.cell} />;
                const k = `${ym.y}-${pad(ym.m + 1)}-${pad(d)}`;
                const on = k === selected;
                return (
                  <Pressable key={i} style={s.cell} onPress={() => { onPick(k); onClose(); }} accessibilityLabel={`Select ${k}`}>
                    <View style={[s.day, on && { backgroundColor: c.btn }, !on && k === today && { borderWidth: 2, borderColor: c.lime }]}>
                      <Text style={[s.dayT, on && { color: '#fff' }]}>{d}</Text>
                    </View>
                    <View style={[s.dot, { opacity: marks.has(k) ? 1 : 0 }, on && { backgroundColor: c.lime }]} />
                  </Pressable>
                );
              })}
            </View>
          ))}
          <Pressable onPress={() => { onPick(today); onClose(); }} style={s.todayBtn} accessibilityRole="button">
            <Text style={s.todayT}>Go to today</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const mkStyles = () => StyleSheet.create({
  title: { fontFamily: f.extra, fontSize: 17, color: c.ink, textAlign: 'center', marginBottom: 10 },
  wrap: { flex: 1, backgroundColor: 'rgba(21,32,15,0.4)', justifyContent: 'center', paddingHorizontal: 20 },
  card: { backgroundColor: c.card, borderRadius: 30, padding: 18 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  arrow: { width: 38, height: 38, borderRadius: 19, backgroundColor: c.page, alignItems: 'center', justifyContent: 'center' },
  month: { fontFamily: f.extra, fontSize: 18, color: c.ink, letterSpacing: -0.3 },
  row: { flexDirection: 'row' },
  wd: { flex: 1, textAlign: 'center', fontFamily: f.semi, fontSize: 12, color: c.soft, paddingVertical: 6 },
  cell: { flex: 1, height: 46, alignItems: 'center', justifyContent: 'center' },
  day: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  dayT: { fontFamily: f.bold, fontSize: 14, color: c.ink },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: c.lime, marginTop: 1 },
  todayBtn: { alignSelf: 'center', marginTop: 10, paddingVertical: 10, paddingHorizontal: 18, borderRadius: 20, backgroundColor: c.tint },
  todayT: { fontFamily: f.bold, fontSize: 13, color: c.limeText },
});
let s = mkStyles();
onTheme(() => { s = mkStyles(); });
