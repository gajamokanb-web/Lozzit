import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { c, f } from '../theme';
import { entryBase, fmt, MEALS, scale, type Base, type MealKey } from '../domain';
import { lookupBarcode, searchCiqual, searchOff, type Food } from '../foods';
import { useStore } from '../store';
import { card, Icon, P } from '../ui';

export type AddTarget = { meal: MealKey; day: string; editId?: string; mode?: 'search' | 'scan' };
type Mode = 'search' | 'scan' | 'quick' | 'qty';

const num = (t: string) => {
  const n = parseFloat(t.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : 0;
};
const unitLabel = (u: Base['unit'], q: number) => (u === 'srv' ? (q === 1 ? 'serving' : 'servings') : u);

function FoodRow({ food, onPress }: { food: Food; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={s.res} accessibilityRole="button">
      <View style={{ flex: 1 }}>
        <Text style={s.resName} numberOfLines={2}>{food.name}</Text>
        {food.brand ? <Text style={s.resSub} numberOfLines={1}>{food.brand}</Text> : null}
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={s.resKcal}>{fmt(food.per.kcal)}</Text>
        <Text style={s.resSub}>kcal / 100 {food.unit}</Text>
      </View>
    </Pressable>
  );
}

export function AddFood({ target, onClose }: { target: AddTarget | null; onClose: () => void }) {
  const { state, addEntry, updateEntry, removeEntry } = useStore();
  const { top, bottom } = useSafeAreaInsets();
  const [perm, askPerm] = useCameraPermissions();

  const [mode, setMode] = useState<Mode>('search');
  const [meal, setMeal] = useState<MealKey>('breakfast');
  const [query, setQuery] = useState('');
  const [online, setOnline] = useState(false);
  const [offRes, setOffRes] = useState<Food[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [food, setFood] = useState<{ name: string; brand?: string; base: Base; fk?: string; portion?: Food['portion'] } | null>(null);
  const [qty, setQty] = useState('');
  const [qName, setQName] = useState('');
  const [qKcal, setQKcal] = useState('');
  const [qP, setQP] = useState('');
  const [qC, setQC] = useState('');
  const [qF, setQF] = useState('');
  const scanned = useRef(false);

  const editing = target?.editId ? state.entries.find((e) => e.id === target.editId) : undefined;

  useEffect(() => {
    if (!target) return;
    setMeal(target.meal); setQuery(''); setOnline(false); setOffRes(null); setErr(''); setBusy(false);
    setQName(''); setQKcal(''); setQP(''); setQC(''); setQF('');
    scanned.current = false;
    const e = target.editId ? state.entries.find((x) => x.id === target.editId) : undefined;
    if (e) {
      const { base, qty: q } = entryBase(e);
      setFood({ name: e.name, brand: e.brand, base, fk: e.fk, portion: e.portion });
      setQty(String(q));
      setMeal(e.meal);
      setMode('qty');
    } else {
      setFood(null);
      setMode(target.mode ?? 'search');
    }
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps

  // Foods already logged on this day are not offered again: tap them on the dashboard to change the quantity.
  const todayKeys = useMemo(() => new Set(state.entries.filter((e) => e.day === target?.day).map((e) => e.fk ?? e.name)), [state.entries, target?.day]);
  const recents = useMemo(() => {
    const seen = new Set<string>();
    const out: Food[] = [];
    for (const e of [...state.entries].reverse()) {
      const k = e.fk ?? e.name;
      if (!e.base || e.base.size !== 100 || seen.has(k) || todayKeys.has(k)) continue;
      seen.add(k);
      out.push({ key: k, name: e.name, brand: e.brand, per: e.base, unit: e.base.unit === 'ml' ? 'ml' : 'g', portion: e.portion, src: k.startsWith('off:') ? 'off' : 'ciqual' });
      if (out.length >= 12) break;
    }
    return out;
  }, [state.entries, todayKeys]);

  const local = useMemo(() => (query.trim().length >= 2 ? searchCiqual(query) : []), [query]);

  // Open Food Facts search runs shortly after typing stops
  useEffect(() => {
    if (!online || query.trim().length < 3) { setOffRes(null); setErr(''); return; }
    let live = true;
    setBusy(true); setErr('');
    const t = setTimeout(async () => {
      try {
        const r = await searchOff(query.trim());
        if (live) setOffRes(r);
      } catch {
        if (live) { setOffRes([]); setErr('Open Food Facts is not reachable. Check your connection and try again.'); }
      } finally {
        if (live) setBusy(false);
      }
    }, 600);
    return () => { live = false; clearTimeout(t); };
  }, [query, online]);

  if (!target) return null;

  const pick = (fd: Food) => {
    setFood({ name: fd.name, brand: fd.brand, base: { ...fd.per, size: 100, unit: fd.unit }, fk: fd.key, portion: fd.portion });
    setQty(String(fd.portion?.size ?? 100));
    setMode('qty');
  };

  const onScan = async ({ data }: { data: string }) => {
    if (scanned.current) return;
    scanned.current = true;
    setBusy(true); setErr('');
    try {
      const fd = await lookupBarcode(data);
      if (fd) return pick(fd);
      setErr(`No product found for ${data}. Search by name or use Quick add.`);
    } catch {
      setErr('Open Food Facts is not reachable. Check your connection and try again.');
    } finally {
      setBusy(false);
      setTimeout(() => { scanned.current = false; }, 2500);
    }
  };

  const q = num(qty);
  const totals = food ? scale(food.base, q) : null;
  const step = food ? (food.base.unit === 'srv' ? 0.5 : 10) : 1;

  const save = () => {
    if (!food || !totals || q <= 0) return;
    const common = { name: food.name, brand: food.brand, ...totals, base: food.base, qty: q, fk: food.fk, portion: food.portion };
    if (editing) updateEntry(editing.id, common);
    else addEntry({ day: target.day, meal, ...common });
    onClose();
  };
  const quickAdd = () => {
    const kcal = Math.round(num(qKcal));
    if (kcal <= 0) return;
    const per = { kcal, p: num(qP), c: num(qC), f: num(qF) };
    const label = MEALS.find((m) => m.key === meal)!.label;
    addEntry({ day: target.day, meal, name: qName.trim() || label, ...per, base: { ...per, size: 1, unit: 'srv' }, qty: 1 });
    onClose();
  };

  const title = mode === 'qty' ? (editing ? 'Edit quantity' : 'Add to log') : mode === 'quick' ? 'Quick add' : mode === 'scan' ? 'Scan barcode' : 'Add food';
  const back = mode === 'qty' && !editing ? () => setMode('search') : mode === 'quick' || mode === 'scan' ? () => setMode('search') : onClose;

  return (
    <Modal visible animationType="slide" onRequestClose={back} statusBarTranslucent>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.page }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[s.head, { paddingTop: top + 10 }]}>
          <Pressable onPress={back} style={s.round} accessibilityLabel="Back"><Icon d={mode === 'search' ? P.x : P.back} size={20} /></Pressable>
          <Text style={s.h}>{title}</Text>
          <View style={{ width: 42 }} />
        </View>

        {mode === 'search' && (
          <>
            <View style={s.searchRow}>
              <TextInput
                style={s.search}
                value={query}
                onChangeText={setQuery}
                placeholder={online ? 'Search brands (Open Food Facts)' : 'Search foods (Ciqual)'}
                placeholderTextColor={c.soft}
                autoFocus={!target.mode}
                returnKeyType="search"
                selectionColor={c.lime}
              />
              <Pressable onPress={() => { setErr(''); setMode('scan'); }} style={s.scanBtn} accessibilityLabel="Scan barcode"><Icon d={P.scan} size={22} /></Pressable>
            </View>
            <View style={s.seg}>
              {[['Foods · Ciqual', false], ['Brands · Open Food Facts', true]].map(([l, v]) => (
                <Pressable key={l as string} onPress={() => setOnline(v as boolean)} style={[s.segB, online === v && { backgroundColor: c.ink }]}>
                  <Text style={[s.segT, online === v && { color: c.lime }]}>{l as string}</Text>
                </Pressable>
              ))}
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: Math.max(bottom, 16) + 20 }}>
              {query.trim().length === 0 && (
                <>
                  <Pressable onPress={() => setMode('quick')} style={[s.quick, card]} accessibilityRole="button">
                    <Icon d={P.plus} size={18} color={c.limeText} sw={2.6} />
                    <Text style={s.quickT}>Quick add calories</Text>
                  </Pressable>
                  {recents.length > 0 && <Text style={s.sect}>Recent</Text>}
                  {recents.map((fd) => <FoodRow key={fd.key} food={fd} onPress={() => pick(fd)} />)}
                  {recents.length === 0 && <Text style={s.hint}>Type a food name, or scan a barcode.</Text>}
                </>
              )}
              {!online && query.trim().length > 0 && query.trim().length < 2 && <Text style={s.hint}>Keep typing…</Text>}
              {!online && local.map((fd) => <FoodRow key={fd.key} food={fd} onPress={() => pick(fd)} />)}
              {!online && local.length === 0 && query.trim().length >= 2 && (
                <Text style={s.hint}>Nothing in Ciqual for "{query}". Try “Brands” for packaged products.</Text>
              )}
              {online && query.trim().length > 0 && query.trim().length < 3 && <Text style={s.hint}>Keep typing…</Text>}
              {online && busy && <ActivityIndicator color={c.limeText} style={{ marginTop: 24 }} />}
              {online && !busy && err ? <Text style={s.err}>{err}</Text> : null}
              {online && !busy && !err && offRes && offRes.length === 0 && <Text style={s.hint}>No product found.</Text>}
              {online && !busy && offRes?.map((fd) => <FoodRow key={fd.key} food={fd} onPress={() => pick(fd)} />)}
              {query.trim().length > 0 && (
                <Text style={s.credit}>{online ? 'Product data: Open Food Facts (ODbL).' : 'Source: Anses, Table de composition nutritionnelle Ciqual 2025 (Licence Ouverte Etalab 2.0).'}</Text>
              )}
            </ScrollView>
          </>
        )}

        {mode === 'scan' && (
          <View style={{ flex: 1 }}>
            {perm?.granted ? (
              <View style={s.camWrap}>
                <CameraView
                  style={StyleSheet.absoluteFill}
                  facing="back"
                  barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
                  onBarcodeScanned={onScan}
                />
                <View style={s.frame} pointerEvents="none" />
                {busy && <ActivityIndicator color="#fff" size="large" style={StyleSheet.absoluteFill} />}
              </View>
            ) : (
              <View style={s.center}>
                <Text style={s.hint}>Allow the camera to scan barcodes.</Text>
                <Pressable onPress={askPerm} style={[s.cta, { alignSelf: 'stretch', marginTop: 16 }]}><Text style={s.ctaText}>Allow camera</Text></Pressable>
              </View>
            )}
            {err ? <Text style={[s.err, { marginHorizontal: 20 }]}>{err}</Text> : <Text style={[s.hint, { textAlign: 'center', marginTop: 14 }]}>Point the camera at a barcode.</Text>}
            <Pressable onPress={() => setMode('search')} style={{ alignSelf: 'center', padding: 16, marginBottom: Math.max(bottom, 8) }}>
              <Text style={s.link}>Search by name instead</Text>
            </Pressable>
          </View>
        )}

        {mode === 'quick' && (
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 12 }}>
            <MealChips meal={meal} setMeal={setMeal} />
            <TextInput style={s.input} value={qName} onChangeText={setQName} placeholder="Name (optional)" placeholderTextColor={c.soft} maxLength={40} selectionColor={c.lime} />
            <View style={s.kcalBox}>
              <TextInput style={s.kcalInput} value={qKcal} onChangeText={setQKcal} placeholder="0" placeholderTextColor={c.soft} keyboardType="number-pad" maxLength={4} selectionColor={c.lime} autoFocus />
              <Text style={s.unit}>kcal</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {([['Protein', qP, setQP], ['Carbs', qC, setQC], ['Fat', qF, setQF]] as const).map(([l, v, set]) => (
                <View key={l} style={s.macro}>
                  <Text style={s.macroL}>{l} (g)</Text>
                  <TextInput style={s.macroIn} value={v} onChangeText={set} placeholder="0" placeholderTextColor={c.soft} keyboardType="decimal-pad" maxLength={4} selectionColor={c.lime} />
                </View>
              ))}
            </View>
            <Pressable onPress={quickAdd} disabled={num(qKcal) <= 0} style={[s.cta, num(qKcal) <= 0 && { opacity: 0.35 }]}><Text style={s.ctaText}>Add to log</Text></Pressable>
          </ScrollView>
        )}

        {mode === 'qty' && food && totals && (
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: Math.max(bottom, 16) + 20 }}>
            <View>
              <Text style={s.foodName}>{food.name}</Text>
              {food.brand ? <Text style={s.resSub}>{food.brand}</Text> : null}
            </View>
            {!editing && <MealChips meal={meal} setMeal={setMeal} />}
            <View style={[s.qtyBox, card]}>
              <Pressable onPress={() => setQty(String(Math.max(0, +(q - step).toFixed(2))))} style={s.stepper} hitSlop={6} accessibilityLabel="Less"><Icon d={P.minus} size={20} sw={2.6} /></Pressable>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center' }}>
                <TextInput style={s.qtyIn} value={qty} onChangeText={setQty} keyboardType="decimal-pad" maxLength={6} selectionColor={c.lime} selectTextOnFocus accessibilityLabel="Quantity" />
                <Text style={s.unit}>{unitLabel(food.base.unit, q)}</Text>
              </View>
              <Pressable onPress={() => setQty(String(+(q + step).toFixed(2)))} style={[s.stepper, { backgroundColor: c.ink }]} hitSlop={6} accessibilityLabel="More"><Icon d={P.plus} size={20} sw={2.6} color={c.lime} /></Pressable>
            </View>
            {food.portion && (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {[0.5, 1, 2].map((m) => (
                  <Pressable key={m} onPress={() => setQty(String(+(food.portion!.size * m).toFixed(1)))} style={s.pchip}>
                    <Text style={s.pchipT}>{m === 1 ? food.portion!.label : `${m}×`}</Text>
                  </Pressable>
                ))}
              </View>
            )}
            <View style={s.sum}>
              <Text style={s.sumBig}>{fmt(totals.kcal)}<Text style={s.sumUnit}> kcal</Text></Text>
              <Text style={s.sumMacros}>{totals.p}g protein · {totals.c}g carbs · {totals.f}g fat</Text>
            </View>
            <Pressable onPress={save} disabled={q <= 0} style={[s.cta, q <= 0 && { opacity: 0.35 }]} accessibilityRole="button">
              <Text style={s.ctaText}>{editing ? 'Save' : `Add to ${MEALS.find((m) => m.key === meal)!.label.toLowerCase()}`}</Text>
            </Pressable>
            {editing && (
              <Pressable onPress={() => { removeEntry(editing.id); onClose(); }} style={{ alignSelf: 'center', padding: 12 }} accessibilityRole="button">
                <Text style={[s.link, { color: c.red }]}>Remove from log</Text>
              </Pressable>
            )}
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

function MealChips({ meal, setMeal }: { meal: MealKey; setMeal: (m: MealKey) => void }) {
  return (
    <View style={s.chips}>
      {MEALS.map((m) => (
        <Pressable key={m.key} onPress={() => setMeal(m.key)} style={[s.mchip, meal === m.key && { backgroundColor: c.ink }]}>
          <Text style={[s.mchipText, meal === m.key && { color: c.lime }]}>{m.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 10 },
  round: { width: 42, height: 42, borderRadius: 21, ...card, alignItems: 'center', justifyContent: 'center' },
  h: { fontFamily: f.extra, fontSize: 20, color: c.ink, letterSpacing: -0.4 },
  searchRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginTop: 4 },
  search: { ...card, flex: 1, borderRadius: 22, paddingHorizontal: 18, height: 52, fontFamily: f.medium, fontSize: 16, color: c.ink },
  scanBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: c.lime, alignItems: 'center', justifyContent: 'center' },
  seg: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginVertical: 12 },
  segB: { ...card, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9 },
  segT: { fontFamily: f.bold, fontSize: 12.5, color: c.ink },
  quick: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  quickT: { fontFamily: f.bold, fontSize: 15, color: c.limeText },
  sect: { fontFamily: f.extra, fontSize: 16, color: c.ink, marginTop: 18, marginBottom: 6 },
  hint: { fontFamily: f.regular, fontSize: 14.5, color: c.muted, marginTop: 18, lineHeight: 21 },
  err: { fontFamily: f.medium, fontSize: 14, color: c.red, marginTop: 18, lineHeight: 20 },
  credit: { fontFamily: f.regular, fontSize: 11.5, color: c.soft, marginTop: 20, textAlign: 'center' },
  res: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: c.line },
  resName: { fontFamily: f.semi, fontSize: 15, color: c.ink },
  resSub: { fontFamily: f.regular, fontSize: 12.5, color: c.muted, marginTop: 2 },
  resKcal: { fontFamily: f.extra, fontSize: 16, color: c.ink },
  camWrap: { flex: 1, margin: 20, borderRadius: 28, overflow: 'hidden', backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  frame: { width: 260, height: 150, borderRadius: 20, borderWidth: 3, borderColor: c.lime },
  center: { flex: 1, padding: 30, justifyContent: 'center' },
  link: { fontFamily: f.bold, fontSize: 14, color: c.limeText },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  mchip: { ...card, borderRadius: 20, paddingHorizontal: 13, paddingVertical: 9 },
  mchipText: { fontFamily: f.bold, fontSize: 13, color: c.ink },
  input: { ...card, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 13, fontFamily: f.medium, fontSize: 15, color: c.ink },
  kcalBox: { ...card, borderRadius: 22, paddingHorizontal: 18, paddingVertical: 8, flexDirection: 'row', alignItems: 'baseline' },
  kcalInput: { flex: 1, fontFamily: f.extra, fontSize: 32, color: c.ink, letterSpacing: -0.8 },
  unit: { fontFamily: f.semi, fontSize: 15, color: c.muted },
  macro: { ...card, flex: 1, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8 },
  macroL: { fontFamily: f.semi, fontSize: 11, color: c.muted },
  macroIn: { fontFamily: f.bold, fontSize: 18, color: c.ink, paddingVertical: 2 },
  foodName: { fontFamily: f.extra, fontSize: 22, color: c.ink, letterSpacing: -0.5, lineHeight: 28 },
  qtyBox: { borderRadius: 26, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepper: { width: 52, height: 52, borderRadius: 26, backgroundColor: c.page, alignItems: 'center', justifyContent: 'center' },
  qtyIn: { fontFamily: f.extra, fontSize: 38, color: c.ink, letterSpacing: -1, minWidth: 70, textAlign: 'right', paddingVertical: 0 },
  pchip: { backgroundColor: c.tint, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9 },
  pchipT: { fontFamily: f.bold, fontSize: 12.5, color: c.limeText },
  sum: { backgroundColor: c.lime, borderRadius: 26, padding: 18 },
  sumBig: { fontFamily: f.extra, fontSize: 34, color: c.ink, letterSpacing: -1 },
  sumUnit: { fontFamily: f.bold, fontSize: 15, letterSpacing: 0 },
  sumMacros: { fontFamily: f.semi, fontSize: 13, color: c.ink, opacity: 0.8, marginTop: 4 },
  cta: { height: 56, borderRadius: 28, backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontFamily: f.bold, fontSize: 16, color: c.lime },
});
