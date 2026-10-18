import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { c, f } from '../theme';
import { MEALS, type MealKey } from '../domain';
import { useStore } from '../store';
import { card, Icon, P } from '../ui';

const num = (t: string) => {
  const n = parseFloat(t.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

export function EntryRow({ name, kcal, onRemove }: { name: string; kcal: number; onRemove: () => void }) {
  return (
    <View style={s.row}>
      <Text style={s.rowName} numberOfLines={1}>{name}</Text>
      <Text style={s.rowKcal}>{kcal} kcal</Text>
      <Pressable onPress={onRemove} hitSlop={10} style={s.rowX} accessibilityLabel={`Remove ${name}`}>
        <Icon d={P.x} size={16} color={c.muted} />
      </Pressable>
    </View>
  );
}

export function AddFood({ target, onClose }: { target: { meal: MealKey; day: string } | null; onClose: () => void }) {
  const { state, addEntry, removeEntry } = useStore();
  const { bottom } = useSafeAreaInsets();
  const [meal, setMeal] = useState<MealKey>('breakfast');
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('');
  const [p, setP] = useState('');
  const [cb, setCb] = useState('');
  const [fat, setFat] = useState('');

  useEffect(() => {
    if (target) {
      setMeal(target.meal);
      setName(''); setKcal(''); setP(''); setCb(''); setFat('');
    }
  }, [target]);

  if (!target) return null;
  const day = target.day;
  const list = state.entries.filter((e) => e.day === day && e.meal === meal);
  const canAdd = num(kcal) > 0;

  const add = () => {
    if (!canAdd) return;
    const label = MEALS.find((m) => m.key === meal)!.label;
    addEntry({ day, meal, name: name.trim() || label, kcal: Math.round(num(kcal)), p: num(p), c: num(cb), f: num(fat) });
    setName(''); setKcal(''); setP(''); setCb(''); setFat('');
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel="Close" />
        <View style={[s.sheet, { paddingBottom: Math.max(bottom, 16) + 8 }]}>
          <View style={s.grab} />
          <View style={s.head}>
            <Text style={s.h}>Add food</Text>
            <Pressable onPress={onClose} style={s.close} accessibilityLabel="Close"><Icon d={P.x} size={18} /></Pressable>
          </View>
          <View style={s.chips}>
            {MEALS.map((m) => (
              <Pressable key={m.key} onPress={() => setMeal(m.key)} style={[s.mchip, meal === m.key && { backgroundColor: c.ink }]}>
                <Text style={[s.mchipText, meal === m.key && { color: c.lime }]}>{m.label}</Text>
              </Pressable>
            ))}
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 380 }} contentContainerStyle={{ gap: 10 }}>
            {list.map((e) => <EntryRow key={e.id} name={e.name} kcal={e.kcal} onRemove={() => removeEntry(e.id)} />)}
            <TextInput style={s.input} value={name} onChangeText={setName} placeholder="What did you eat? (optional)" placeholderTextColor={c.soft} maxLength={40} selectionColor={c.lime} />
            <View style={s.kcalBox}>
              <TextInput style={s.kcalInput} value={kcal} onChangeText={setKcal} placeholder="0" placeholderTextColor={c.soft} keyboardType="number-pad" maxLength={4} selectionColor={c.lime} />
              <Text style={s.kcalUnit}>kcal</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {[['Protein', p, setP], ['Carbs', cb, setCb], ['Fat', fat, setFat]].map(([l, v, set]) => (
                <View key={l as string} style={[s.macro]}>
                  <Text style={s.macroL}>{l as string} (g)</Text>
                  <TextInput style={s.macroIn} value={v as string} onChangeText={set as (t: string) => void} placeholder="0" placeholderTextColor={c.soft} keyboardType="decimal-pad" maxLength={4} selectionColor={c.lime} />
                </View>
              ))}
            </View>
          </ScrollView>

          <Pressable onPress={add} disabled={!canAdd} style={[s.cta, !canAdd && { opacity: 0.35 }]} accessibilityRole="button">
            <Text style={s.ctaText}>Add to {MEALS.find((m) => m.key === meal)!.label.toLowerCase()}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(21,32,15,0.35)' },
  sheet: { backgroundColor: c.page, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 20, paddingTop: 10, gap: 14 },
  grab: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: c.line },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  h: { fontFamily: f.extra, fontSize: 22, color: c.ink, letterSpacing: -0.5 },
  close: { width: 38, height: 38, borderRadius: 19, ...card, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', gap: 8 },
  mchip: { ...card, borderRadius: 20, paddingHorizontal: 13, paddingVertical: 9 },
  mchipText: { fontFamily: f.bold, fontSize: 13, color: c.ink },
  row: { ...card, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowName: { flex: 1, fontFamily: f.semi, fontSize: 14, color: c.ink },
  rowKcal: { fontFamily: f.bold, fontSize: 13, color: c.ink },
  rowX: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  input: { ...card, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 13, fontFamily: f.medium, fontSize: 15, color: c.ink },
  kcalBox: { ...card, borderRadius: 22, paddingHorizontal: 18, paddingVertical: 8, flexDirection: 'row', alignItems: 'baseline' },
  kcalInput: { flex: 1, fontFamily: f.extra, fontSize: 32, color: c.ink, letterSpacing: -0.8 },
  kcalUnit: { fontFamily: f.semi, fontSize: 15, color: c.muted },
  macro: { ...card, flex: 1, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8 },
  macroL: { fontFamily: f.semi, fontSize: 11, color: c.muted },
  macroIn: { fontFamily: f.bold, fontSize: 18, color: c.ink, paddingVertical: 2 },
  cta: { height: 56, borderRadius: 28, backgroundColor: c.lime, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontFamily: f.bold, fontSize: 16, color: c.ink },
});
