import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../i18n';
import { c, f, onTheme } from '../theme';
import { fmt } from '../domain';
import { KbView } from '../ui';

type Op = '×' | '÷';
const CHIPS: [Op, number][] = [['÷', 4], ['÷', 3], ['÷', 2], ['×', 1.5], ['×', 2], ['×', 3]];

/** Multiply or divide quantities: used when copying a meal and by "Factory" on a meal block. */
export function FactorModal({ visible, title, confirm, kcal, onApply, onClose }: { visible: boolean; title: string; confirm: string; kcal: number; onApply: (factor: number) => void; onClose: () => void }) {
  const [op, setOp] = useState<Op>('×');
  const [n, setN] = useState('1');
  useEffect(() => { if (visible) { setOp('×'); setN('1'); } }, [visible]);
  const v = parseFloat(n.replace(',', '.'));
  const ok = Number.isFinite(v) && v > 0;
  const factor = ok ? (op === '×' ? v : 1 / v) : 1;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KbView style={s.wrap}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <View style={s.card}>
          <Text style={s.h}>{title}</Text>
          <Text style={s.sub}>Divide or multiply every quantity.</Text>
          <View style={s.chips}>
            {CHIPS.map(([o, k]) => {
              const on = op === o && Number(n) === k;
              return (
                <Pressable key={o + k} onPress={() => { setOp(o); setN(String(k)); }} style={[s.chip, on && { backgroundColor: c.btn }]} accessibilityRole="button" accessibilityLabel={`${o}${k}`}>
                  <Text style={[s.chipT, on && { color: c.lime }]}>{o}{k}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={s.row}>
            <View style={s.seg}>
              {(['÷', '×'] as Op[]).map((o) => (
                <Pressable key={o} onPress={() => setOp(o)} style={[s.segB, op === o && { backgroundColor: c.btn }]} accessibilityRole="button" accessibilityLabel={o === '×' ? 'Multiply' : 'Divide'}>
                  <Text style={[s.segT, op === o && { color: c.lime }]}>{o}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput style={s.input} value={n} onChangeText={setN} keyboardType="decimal-pad" maxLength={5} selectTextOnFocus selectionColor={c.lime} accessibilityLabel="Factor" />
          </View>
          <Text style={s.res}>{fmt(kcal * factor)} kcal <Text style={s.resS}>(was {fmt(kcal)})</Text></Text>
          <Pressable onPress={() => ok && onApply(factor)} disabled={!ok} style={[s.cta, !ok && { opacity: 0.35 }]} accessibilityRole="button"><Text style={s.ctaT}>{confirm}</Text></Pressable>
          <Pressable onPress={onClose} style={{ alignSelf: 'center', padding: 10 }}><Text style={s.link}>Cancel</Text></Pressable>
        </View>
      </KbView>
    </Modal>
  );
}

const mkStyles = () => StyleSheet.create({
  wrap: { flex: 1, backgroundColor: 'rgba(21,32,15,0.45)', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: c.card, borderRadius: 30, padding: 22, gap: 14 },
  h: { fontFamily: f.extra, fontSize: 20, color: c.ink, letterSpacing: -0.4 },
  sub: { fontFamily: f.regular, fontSize: 13.5, color: c.muted, marginTop: -8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: c.page, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 10 },
  chipT: { fontFamily: f.bold, fontSize: 14, color: c.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  seg: { flexDirection: 'row', backgroundColor: c.page, borderRadius: 22, padding: 4 },
  segB: { width: 46, height: 40, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  segT: { fontFamily: f.extra, fontSize: 20, color: c.ink },
  input: { flex: 1, minWidth: 0, backgroundColor: c.page, borderRadius: 18, paddingHorizontal: 16, height: 48, fontFamily: f.extra, fontSize: 22, color: c.ink },
  res: { fontFamily: f.extra, fontSize: 22, color: c.ink },
  resS: { fontFamily: f.medium, fontSize: 13, color: c.muted },
  cta: { height: 54, borderRadius: 27, backgroundColor: c.btn, alignItems: 'center', justifyContent: 'center' },
  ctaT: { fontFamily: f.bold, fontSize: 16, color: c.lime },
  link: { fontFamily: f.bold, fontSize: 14, color: c.limeText },
});
let s = mkStyles();
onTheme(() => { s = mkStyles(); });
