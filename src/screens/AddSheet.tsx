import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing,  Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../i18n';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { c, f, onTheme } from '../theme';
import { fmtDay, MEALS, type MealKey } from '../domain';
import { Calendar } from './Calendar';
import { useStore } from '../store';
import { Disc, Icon, MealIcon, P, KbView } from '../ui';

export type SheetView = 'grid' | 'water' | 'weight';
type View_ = SheetView;

/** The "+" menu: pick a meal to add food to, or log water or body weight (Lose It-style). */
export function AddSheet({ visible, start = 'grid', day, suggested, onClose, onMeal }: { visible: boolean; start?: SheetView; day: string; suggested: MealKey; onClose: () => void; onMeal: (m: MealKey) => void }) {
  const { state, setWater, setWeight } = useStore();
  const { bottom } = useSafeAreaInsets();
  const [view, setView] = useState<View_>('grid');
  const [kg, setKg] = useState('');
  const [wDay, setWDay] = useState(day);
  const [cal, setCal] = useState(false);

  // slide up from the bottom, fade the backdrop; reverse on close
  const [show, setShow] = useState(false);
  const y = useRef(new Animated.Value(520)).current;
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) {
      setShow(true);
      y.setValue(520); fade.setValue(0);
      Animated.parallel([
        Animated.timing(y, { toValue: 0, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(fade, { toValue: 1, duration: 260, useNativeDriver: true }),
      ]).start();
    } else if (show) {
      Animated.parallel([
        Animated.timing(y, { toValue: 520, duration: 240, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(fade, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start(() => setShow(false));
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!visible) return;
    setView(start); setWDay(day);
    const last = Object.keys(state.weights).sort().pop();
    setKg(String(state.weights[day] ?? (last ? state.weights[last] : state.profile?.weightKg ?? '')));
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const pickDay = (k: string) => { setWDay(k); if (state.weights[k] != null) setKg(String(state.weights[k])); };
  const drops = state.water[day] ?? 0;
  const kgNum = parseFloat(kg.replace(',', '.'));
  const kgOk = Number.isFinite(kgNum) && kgNum >= 20 && kgNum <= 400;

  const Tile = ({ label, children, onPress, on }: { label: string; children: React.ReactNode; onPress: () => void; on?: boolean }) => (
    <Pressable onPress={onPress} style={s.tile} accessibilityRole="button" accessibilityLabel={label}>
      <View style={[s.disc, on && { borderColor: c.lime }]}>{children}</View>
      <Text style={s.tileL} numberOfLines={2}>{label}</Text>
    </Pressable>
  );

  return (
    <Modal visible={show} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <KbView style={{ flex: 1 }}>
        <Animated.View style={[s.backdrop, { opacity: fade }]}>
          <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Close" />
          <Calendar visible={cal} selected={wDay} marks={new Set(Object.keys(state.weights))} title="Date of the weigh-in" onPick={pickDay} onClose={() => setCal(false)} />
        </Animated.View>
        <Animated.View style={[s.sheet, { paddingBottom: Math.max(bottom, 12) + 14, transform: [{ translateY: y }] }]}>
          {view === 'grid' && (
            <View style={s.grid}>
              {MEALS.filter((m) => state.settings.meals.includes(m.key)).map((m) => (
                <Tile key={m.key} label={m.label} on={m.key === suggested} onPress={() => onMeal(m.key)}>
                  <MealIcon k={m.key} size={58} />
                </Tile>
              ))}
              <Tile label="Water" onPress={() => setView('water')}>
                <Disc d={P.drop} bg={c.blue} size={58} fill="#fff" sw={0} />
              </Tile>
              <Tile label="Weight" onPress={() => setView('weight')}>
                <Disc d={P.weight} bg={c.ink} size={58} sw={2.2} />
              </Tile>
            </View>
          )}

          {view === 'water' && (
            <View style={s.panel}>
              <Text style={s.panelH}>Water</Text>
              <View style={s.row}>
                <Pressable onPress={() => setWater(day, Math.max(0, drops - 1))} style={s.step} accessibilityLabel="Remove 250 mL"><Icon d={P.minus} size={22} sw={2.8} color={c.blue} /></Pressable>
                <View style={{ alignItems: 'center', minWidth: 120 }}>
                  <Text style={s.bigNum}>{(drops * 0.25).toFixed(2).replace(/\.?0+$/, '')}<Text style={s.unit}> L</Text></Text>
                  <Text style={s.sub}>{drops} × 250 mL</Text>
                </View>
                <Pressable onPress={() => setWater(day, Math.min(40, drops + 1))} style={[s.step, { backgroundColor: c.blue }]} accessibilityLabel="Add 250 mL"><Icon d={P.plus} size={22} sw={2.8} color="#fff" /></Pressable>
              </View>
              <Pressable onPress={onClose} style={s.cta}><Text style={s.ctaT}>Done</Text></Pressable>
              <Pressable onPress={() => setView('grid')} style={s.linkW}><Text style={s.link}>Back</Text></Pressable>
            </View>
          )}

          {view === 'weight' && (
            <View style={s.panel}>
              <Text style={s.panelH}>Weight</Text>
              <Pressable onPress={() => setCal(true)} style={s.dateBtn} accessibilityRole="button" accessibilityLabel="Choose the date">
                <Icon d={P.calendar} size={16} color={c.limeText} sw={2.2} />
                <Text style={s.dateT}>{fmtDay(wDay)}</Text>
              </Pressable>
              <View style={s.weightBox}>
                <TextInput style={s.weightIn} value={kg} onChangeText={setKg} keyboardType="decimal-pad" maxLength={6} selectTextOnFocus selectionColor={c.lime} accessibilityLabel="Weight in kilograms" />
                <Text style={s.unit}>kg</Text>
              </View>
              <Pressable onPress={() => { if (kgOk) { setWeight(wDay, Math.round(kgNum * 10) / 10); onClose(); } }} disabled={!kgOk} style={[s.cta, !kgOk && { opacity: 0.35 }]}><Text style={s.ctaT}>Save</Text></Pressable>
              <Pressable onPress={() => setView('grid')} style={s.linkW}><Text style={s.link}>Back</Text></Pressable>
            </View>
          )}
        </Animated.View>
      </KbView>
    </Modal>
  );
}

const mkStyles = () => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(21,32,15,0.45)' },
  sheet: { backgroundColor: c.card, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingTop: 22, paddingHorizontal: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  tile: { width: '25%', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 2 },
  disc: { width: 66, height: 66, borderRadius: 33, borderWidth: 3, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  mealImg: { width: 60, height: 60 },
  fillDisc: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  tileL: { fontFamily: f.semi, fontSize: 12.5, color: c.ink, textAlign: 'center', marginTop: 6, lineHeight: 16, minHeight: 32 },
  panel: { paddingHorizontal: 8, paddingBottom: 4, gap: 16 },
  panelH: { fontFamily: f.extra, fontSize: 22, color: c.ink, letterSpacing: -0.5, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18 },
  step: { width: 56, height: 56, borderRadius: 28, backgroundColor: c.blueTint, alignItems: 'center', justifyContent: 'center' },
  bigNum: { fontFamily: f.extra, fontSize: 38, color: c.ink, letterSpacing: -1, lineHeight: 48 },
  unit: { fontFamily: f.semi, fontSize: 16, color: c.muted, letterSpacing: 0 },
  sub: { fontFamily: f.medium, fontSize: 13, color: c.muted },
  dateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, alignSelf: 'center', backgroundColor: c.tint, borderRadius: 20, paddingHorizontal: 16, height: 38, marginBottom: 10 },
  dateT: { fontFamily: f.bold, fontSize: 14, color: c.limeText },
  weightBox: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', backgroundColor: c.page, borderRadius: 24, paddingVertical: 10, gap: 6 },
  weightIn: { fontFamily: f.extra, fontSize: 38, color: c.ink, letterSpacing: -1, minWidth: 100, textAlign: 'right', paddingVertical: 0 },
  cta: { height: 56, borderRadius: 28, backgroundColor: c.btn, alignItems: 'center', justifyContent: 'center' },
  ctaT: { fontFamily: f.bold, fontSize: 16, color: c.lime },
  linkW: { alignSelf: 'center', padding: 8 },
  link: { fontFamily: f.bold, fontSize: 14, color: c.limeText },
});
let s = mkStyles();
onTheme(() => { s = mkStyles(); });
