import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput, tr, getLang } from '../i18n';
import { ICON_FR } from '../iconNames';
import { askConfirm, notify } from '../dialog';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { c, f, onTheme } from '../theme';
import { entryBase, EXTRAS, fmt, fmtDay, MEALS, scale, scaleEntry, sum, type Base, type Entry, type MealKey, type Per } from '../domain';
import { letterOf, lookupBarcode, searchCiqual, searchMine, sortKey, type Food } from '../foods';
import { readLabel, DEFAULT_MODEL } from '../vision';
import { FOOD_ICON_LIST, FoodIcon, suggestIcon } from '../foodIcons';
import { useStore } from '../store';
import { card, Icon, P, KbView } from '../ui';
import { FactorModal } from './Factor';

/** pick: choose a food for something else (e.g. a recipe) instead of logging it; the callback gets the food. */
export type AddTarget = { meal: MealKey; day: string; editId?: string; scan?: boolean; pick?: (fd: Food) => void; query?: string; create?: boolean };
type Mode = 'main' | 'scan' | 'quick' | 'qty' | 'create' | 'icons' | 'label' | 'prev';
type Tab = 'search' | 'mine' | 'meals' | 'recipes';
type Chosen = { name: string; brand?: string; base: Base; fk?: string; portion?: Food['portion']; src?: Food['src']; icon?: string; barcode?: string };

const num = (t: string) => {
  const n = parseFloat(t.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : 0;
};
const unitLabel = (u: Base['unit'], q: number) => (u === 'srv' ? (q === 1 ? 'serving' : 'servings') : u);
const ROW_H = 64;
const HEAD_H = 36;

function FoodRow({ food, onPress, fixed }: { food: Food; onPress: () => void; fixed?: boolean }) {
  return (
    <Pressable onPress={onPress} style={[s.res, fixed && { height: ROW_H }]} accessibilityRole="button">
      <FoodIcon name={food.name} icon={food.icon} size={42} />
      <View style={{ flex: 1 }}>
        <Text style={s.resName} numberOfLines={fixed ? 1 : 2}>{food.name}</Text>
        {food.brand ? <Text style={s.resSub} numberOfLines={1}>{food.brand}</Text> : null}
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={s.resKcal}>{fmt(food.per.kcal)}</Text>
        <Text style={s.resSub}>kcal / 100 {food.unit}</Text>
      </View>
    </Pressable>
  );
}

type Item = { t: 'h'; letter: string } | { t: 'f'; food: Food };

/** Alphabetical list with an A–Z strip on the right to jump to a letter. */
function AlphaList({ foods, onPick, bottom }: { foods: Food[]; onPick: (fd: Food) => void; bottom: number }) {
  const ref = useRef<FlatList<Item>>(null);
  const [barH, setBarH] = useState(0);
  const [active, setActive] = useState<string | null>(null);
  const { items, offsets, letters } = useMemo(() => {
    const items: Item[] = [];
    const offsets: Record<string, number> = {};
    const letters: string[] = [];
    let y = 0;
    let cur = '';
    for (const fd of foods) {
      const l = letterOf(fd.name);
      if (l !== cur) { cur = l; offsets[l] = y; letters.push(l); items.push({ t: 'h', letter: l }); y += HEAD_H; }
      items.push({ t: 'f', food: fd });
      y += ROW_H;
    }
    return { items, offsets, letters };
  }, [foods]);

  const jump = (y: number) => {
    if (!letters.length || barH <= 0) return;
    const i = Math.max(0, Math.min(letters.length - 1, Math.floor((y / barH) * letters.length)));
    setActive(letters[i]);
    ref.current?.scrollToOffset({ offset: offsets[letters[i]], animated: false });
  };

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        ref={ref}
        data={items}
        keyExtractor={(it, i) => (it.t === 'h' ? `h${it.letter}` : `${it.food.key}-${i}`)}
        getItemLayout={(_, i) => ({ length: items[i].t === 'h' ? HEAD_H : ROW_H, offset: items.slice(0, i).reduce((a, it) => a + (it.t === 'h' ? HEAD_H : ROW_H), 0), index: i })}
        renderItem={({ item }) =>
          item.t === 'h' ? (
            <View style={s.letterHead}><Text style={s.letterHeadT}>{item.letter}</Text></View>
          ) : (
            <FoodRow food={item.food} onPress={() => onPick(item.food)} fixed />
          )
        }
        contentContainerStyle={{ paddingLeft: 20, paddingRight: 36, paddingBottom: bottom + 20 }}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={20}
        windowSize={9}
      />
      {letters.length > 1 && (
        <View
          style={s.bar}
          onLayout={(e) => setBarH(e.nativeEvent.layout.height)}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={(e) => jump(e.nativeEvent.locationY)}
          onResponderMove={(e) => jump(e.nativeEvent.locationY)}
          onResponderRelease={() => setActive(null)}
          onResponderTerminate={() => setActive(null)}
        >
          <View pointerEvents="none" style={{ flex: 1, justifyContent: 'space-around', alignItems: 'center' }}>
            {letters.map((l) => <Text key={l} style={[s.barL, active === l && { color: c.ink }]}>{l}</Text>)}
          </View>
        </View>
      )}
      {active && <View style={s.bubble} pointerEvents="none"><Text style={s.bubbleT}>{active}</Text></View>}
    </View>
  );
}

export function AddFood({ target, onClose }: { target: AddTarget | null; onClose: () => void }) {
  const { state, addEntry, updateEntry, removeEntry, saveFood, setSettings } = useStore();
  const { top, bottom } = useSafeAreaInsets();
  const [perm, askPerm] = useCameraPermissions();

  const [mode, setMode] = useState<Mode>('main');
  const [tab, setTab] = useState<Tab>('search');
  const [meal, setMeal] = useState<MealKey>('breakfast');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [miss, setMiss] = useState<{ code: string; offline: boolean } | null>(null);
  const [food, setFood] = useState<Chosen | null>(null);
  const [qty, setQty] = useState('');
  const [qName, setQName] = useState('');
  const [qKcal, setQKcal] = useState('');
  const [qP, setQP] = useState('');
  const [qC, setQC] = useState('');
  const [qF, setQF] = useState('');
  const [qX, setQX] = useState<string[]>(['', '', '', '']);
  const [copyDlg, setCopyDlg] = useState<Entry[] | null>(null);
  const [editKey, setEditKey] = useState<string | null>(null);
  // create-food form
  const [nName, setNName] = useState('');
  const [nBrand, setNBrand] = useState('');
  const [nUnit, setNUnit] = useState<'g' | 'ml'>('g');
  const [nKcal, setNKcal] = useState('');
  const [nP, setNP] = useState('');
  const [nC, setNC] = useState('');
  const [nF, setNF] = useState('');
  const [nX, setNX] = useState<string[]>(['', '', '', '']);
  const [nPortion, setNPortion] = useState('');
  const [nBasis, setNBasis] = useState('100');
  const [nCode, setNCode] = useState('');
  const [nIcon, setNIcon] = useState<string | undefined>(undefined);
  const [nIconTouched, setNIconTouched] = useState(false);
  const [iconQ, setIconQ] = useState('');
  const [iconEdit, setIconEdit] = useState(false);
  const [renIcon, setRenIcon] = useState<{ key: string; name: string } | null>(null);
  const [recQ, setRecQ] = useState('');
  const [labelFrom, setLabelFrom] = useState<Mode>('create');
  const [createFrom, setCreateFrom] = useState<Mode>('main');
  const scanned = useRef(false);
  const cam = useRef<CameraView>(null);
  const [torch, setTorch] = useState(false);
  const [labelBusy, setLabelBusy] = useState(false);
  const [labelMsg, setLabelMsg] = useState('');
  const [res, setRes] = useState<{ name: string; kcal: string; p: string; c: string; f: string; x: string[]; portion: string; note: string } | null>(null);
  const [shot, setShot] = useState<{ uri: string; b64: string } | null>(null);
  useEffect(() => { if (mode !== 'scan' && mode !== 'label') setTorch(false); }, [mode]);

  const editing = target?.editId ? state.entries.find((e) => e.id === target.editId) : undefined;

  useEffect(() => {
    if (!target) return;
    setMeal(target.meal); setQuery(target.query ?? ''); setBusy(false); setMiss(null); setTab('search');
    setQName(''); setQKcal(''); setQP(''); setQC(''); setQF(''); setQX(['', '', '', '']); setEditKey(null); setCopyDlg(null);
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
      if (target.scan) { scanned.current = false; setMode('scan'); } else if (target.create) openCreate('main'); else setMode('main');
    }
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps

  // Foods already logged on this day are not offered again: tap them on the dashboard to change the quantity.
  const todayKeys = useMemo(() => new Set<string>(), []);

  /** Own database: everything saved (added, scanned, created) + foods found in older log entries. */
  const mine = useMemo(() => {
    const m = new Map<string, Food>(Object.entries(state.foods));
    for (const e of state.entries) {
      if (!e.fk || m.has(e.fk) || !e.base || e.base.size !== 100) continue;
      m.set(e.fk, { key: e.fk, name: e.name, brand: e.brand, per: (({ size: _s, unit: _u, ...per }) => per)(e.base), unit: e.base.unit === 'ml' ? 'ml' : 'g', portion: e.portion, src: e.fk.startsWith('off:') ? 'off' : 'ciqual' });
    }
    return [...m.values()];
  }, [state.foods, state.entries]);
  const mineSorted = useMemo(() => mine.filter((x) => !todayKeys.has(x.key)).sort((a, b) => sortKey(a.name).localeCompare(sortKey(b.name))), [mine, todayKeys]);
  const hiddenToday = mine.length - mineSorted.length;

  const recents = useMemo(() => {
    const seen = new Set<string>();
    const out: Food[] = [];
    const byKey = new Map(mine.map((x) => [x.key, x]));
    for (const e of [...state.entries].reverse()) {
      const k = e.fk ?? e.name;
      const fd = e.fk ? byKey.get(e.fk) : undefined;
      if (!fd || seen.has(k) || todayKeys.has(k)) continue;
      seen.add(k);
      out.push(fd);
      if (out.length >= 12) break;
    }
    return out;
  }, [state.entries, mine, todayKeys]);

  const results = useMemo(() => {
    if (query.trim().length < 2) return [];
    const mineHits = searchMine(mine, query).filter((x) => !todayKeys.has(x.key));
    const keys = new Set(mineHits.map((x) => x.key));
    const owned = new Set(mine.map((x) => x.key)); // a food I already saved or edited replaces its table original
    return [...mineHits, ...searchCiqual(query).filter((x) => !keys.has(x.key) && !owned.has(x.key) && !todayKeys.has(x.key))];
  }, [query, mine, todayKeys]);

  const blocks = useMemo(() => {
    const g = new Map<string, { day: string; meal: MealKey; entries: Entry[] }>();
    for (const e of state.entries) {
      if (target && e.day === target.day && e.meal === target.meal) continue;
      const k = `${e.day}|${e.meal}`;
      if (!g.has(k)) g.set(k, { day: e.day, meal: e.meal, entries: [] });
      g.get(k)!.entries.push(e);
    }
    const order = (m: MealKey) => MEALS.findIndex((x) => x.key === m);
    return [...g.values()].sort((a, b) => (a.day === b.day ? order(a.meal) - order(b.meal) : a.day < b.day ? 1 : -1));
  }, [state.entries, target?.day, target?.meal]); // eslint-disable-line react-hooks/exhaustive-deps

  const iconNames = state.settings.iconNames ?? {};
  const iconLabel = (k: string, en: string) => (iconNames[k] !== undefined ? iconNames[k] : getLang() === 'fr' ? ICON_FR[k] ?? en : en);
  const normS = (x: string) => x.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const iconList = useMemo(() => {
    const q = normS(iconQ.trim());
    return FOOD_ICON_LIST.filter((i) => !q || [i.name, ICON_FR[i.key] ?? '', iconNames[i.key] ?? ''].some((n) => normS(n).includes(q)));
  }, [iconQ, iconNames]); // eslint-disable-line react-hooks/exhaustive-deps
  const recipeList = useMemo(() => {
    const q = normS(recQ.trim());
    return state.recipes.filter((r) => !q || normS(r.title).includes(q) || r.ingredients.some((i) => normS(i.name).includes(q)));
  }, [state.recipes, recQ]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!target) return null;

  const pick = (fd: Food) => {
    if (target.pick) { saveFood(fd); target.pick(fd); onClose(); return; }
    setFood({ name: fd.name, brand: fd.brand, base: { ...fd.per, size: 100, unit: fd.unit }, fk: fd.key, portion: fd.portion, src: fd.src, icon: fd.icon, barcode: fd.barcode });
    setQty('100');
    setMode('qty');
  };

  const onScan = async ({ data }: { data: string }) => {
    if (scanned.current) return;
    scanned.current = true;
    setBusy(true); setMiss(null);
    // 1) own database, 2) Open Food Facts (then kept locally), 3) offer to create the food
    const own = mine.find((x) => x.barcode === data);
    if (own) { setBusy(false); return pick(own); }
    try {
      const fd = await lookupBarcode(data);
      if (fd) { saveFood(fd); setBusy(false); return pick(fd); }
      setMiss({ code: data, offline: false });
    } catch {
      setMiss({ code: data, offline: true });
    }
    setBusy(false);
  };

  const q = num(qty);
  const totals = food ? scale(food.base, q) : null;
  const step = food ? (food.base.unit === 'srv' ? 0.5 : 10) : 1;

  const save = () => {
    if (!food || !totals || q <= 0) return;
    const common = { name: food.name, brand: food.brand, ...totals, base: food.base, qty: q, fk: food.fk, portion: food.portion };
    if (editing) updateEntry(editing.id, common);
    else {
      addEntry({ day: target.day, meal, ...common });
      if (food.fk && food.base.size === 100 && food.base.unit !== 'srv') {
        const { size: _size, unit, ...per } = food.base; // eslint-disable-line @typescript-eslint/no-unused-vars
        saveFood({ key: food.fk, name: food.name, brand: food.brand, per, unit, portion: food.portion, src: food.src ?? 'ciqual', icon: food.icon, barcode: food.barcode });
      }
    }
    onClose();
  };
  const quickAdd = () => {
    const kcal = Math.round(num(qKcal));
    if (kcal <= 0) return;
    const per: Per = { kcal, p: num(qP), c: num(qC), f: num(qF) };
    EXTRAS.forEach((x, i) => { if (qX[i].trim()) per[x.k] = num(qX[i]); });
    const label = MEALS.find((m) => m.key === meal)!.label;
    addEntry({ day: target.day, meal, name: qName.trim() || label, ...per, base: { ...per, size: 1, unit: 'srv' }, qty: 1 });
    onClose();
  };
  /** Logs the ingredients of a recipe for one serving. */
  const addRecipe = (r: (typeof state.recipes)[number]) => {
    const n = r.servings && r.servings > 0 ? r.servings : 1;
    let added = 0, skipped = 0;
    for (const i of r.ingredients) {
      const fd = i.fk ? state.foods[i.fk] : undefined;
      if (!fd || !(i.g > 0)) { skipped++; continue; }
      const base: Base = { ...fd.per, size: 100, unit: fd.unit };
      const qty = Math.round((i.g / n) * 10) / 10;
      addEntry({ day: target.day, meal, name: fd.name, brand: fd.brand, ...scale(base, qty), base, qty, fk: fd.key, portion: fd.portion });
      added++;
    }
    if (added === 0) { notify('Nothing to add', 'No ingredient of this recipe is linked to a food yet.'); return; }
    if (skipped > 0) notify('Recipe added', `${skipped} ingredient(s) without a linked food were left out.`);
    onClose();
  };
  const copyBlock = (entries: Entry[], factor: number) => {
    for (const e of entries) {
      const { id, day, meal: _m, ...rest } = e; // eslint-disable-line @typescript-eslint/no-unused-vars
      addEntry({ ...rest, ...(factor === 1 ? {} : scaleEntry(e, factor)), day: target.day, meal: target.meal });
    }
    setCopyDlg(null);
    onClose();
  };

  const openLabel = async (from: Mode = 'create') => {
    setLabelFrom(from);
    setLabelMsg('');
    if (!state.settings.groqKey.trim()) return setLabelMsg('Add your Groq API key first: Profile → AI label scan.');
    if (!perm?.granted) { const r = await askPerm(); if (!r.granted) return setLabelMsg('Camera permission is needed to photograph the label.'); }
    setMode('label');
  };
  const openGallery = async () => {
    setLabelMsg('');
    if (!state.settings.groqKey.trim()) return setLabelMsg('Add your Groq API key first: Profile → AI label scan.');
    try {
      const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, base64: true });
      if (r.canceled) return;
      const a = r.assets?.[0];
      if (!a?.base64) return setLabelMsg('This image could not be read. Pick another one.');
      setShot({ uri: a.uri, b64: a.base64 }); setRes(null);
      setMode('prev');
    } catch {
      setLabelMsg('The gallery could not be opened.');
    }
  };
  const snapLabel = async () => {
    if (labelBusy || !cam.current) return;
    setLabelMsg('');
    try {
      const pic = await cam.current.takePictureAsync({ quality: 0.6, base64: true, skipProcessing: true });
      if (!pic?.base64) throw new Error('The photo could not be taken. Try again.');
      setShot({ uri: pic.uri, b64: pic.base64 }); setRes(null);
      setMode('prev');
    } catch (e) {
      setLabelMsg(e instanceof Error ? e.message : 'The photo could not be taken.');
    }
  };
  const sendLabel = async () => {
    if (labelBusy || !shot) return;
    setLabelBusy(true); setLabelMsg('');
    try {
      const r = await readLabel(shot.b64, state.settings.groqKey.trim(), state.settings.groqModel.trim() || DEFAULT_MODEL);
      setRes({
        name: r.name ?? '', kcal: String(r.per.kcal), p: String(r.per.p), c: String(r.per.c), f: String(r.per.f),
        x: EXTRAS.map((x) => (r.per[x.k] != null ? String(r.per[x.k]) : '')),
        portion: r.servingG ? String(r.servingG) : '', note: r.note ?? '',
      });
      setMode('prev');
    } catch (e) {
      setLabelMsg(e instanceof Error ? e.message : 'The label could not be read.');
      setMode('prev');
    } finally {
      setLabelBusy(false);
    }
  };

  /** The user validated the scanned values: move them into the create-food form. */
  const useScanned = () => {
    if (!res) return;
    if (labelFrom === 'quick') {
      setQKcal(res.kcal); setQP(res.p); setQC(res.c); setQF(res.f); setQX(res.x);
      if (res.name.trim() && !qName.trim()) setQName(res.name.trim());
      setLabelMsg('Values read from the label (per 100 g): check them before adding.');
      setMode('quick');
      return;
    }
    setNUnit('g'); setNBasis('100');
    setNKcal(res.kcal); setNP(res.p); setNC(res.c); setNF(res.f); setNX(res.x);
    if (res.portion) setNPortion(res.portion);
    if (res.name.trim() && !nName.trim()) { setNName(res.name.trim()); if (!nIconTouched) setNIcon(suggestIcon(res.name)); }
    setLabelMsg('Values read from the label: check them before saving.');
    setMode('create');
  };

  const openCreate = (from: Mode, preset?: { name?: string; code?: string }) => {
    const name = preset?.name ?? '';
    setEditKey(null); setNX(['', '', '', '']); setLabelMsg('');
    setNName(name); setNBrand(''); setNUnit('g'); setNBasis('100'); setNKcal(''); setNP(''); setNC(''); setNF(''); setNPortion('');
    setNCode(preset?.code ?? ''); setNIcon(suggestIcon(name)); setNIconTouched(false); setCreateFrom(from);
    setMode('create');
  };
  /** Change the nutrition values (per 100 g/ml) of the food being added. */
  const openEdit = () => {
    if (!food?.fk) return;
    const b = food.base;
    setEditKey(food.fk); setNBasis('100');
    setNName(food.name); setNBrand(food.brand ?? ''); setNUnit(b.unit === 'ml' ? 'ml' : 'g');
    setNKcal(String(b.kcal)); setNP(String(b.p)); setNC(String(b.c)); setNF(String(b.f));
    setNX(EXTRAS.map((x) => (b[x.k] != null ? String(b[x.k]) : '')));
    setNPortion(food.portion ? String(food.portion.size) : ''); setNCode(food.barcode ?? '');
    setNIcon(food.icon ?? suggestIcon(food.name)); setNIconTouched(true); setCreateFrom('qty');
    setMode('create');
  };
  const createOk = nName.trim().length > 0 && num(nKcal) > 0;
  const createFood = () => {
    if (!createOk) return;
    const code = nCode.trim();
    const basis = num(nBasis) > 0 ? num(nBasis) : 100;
    const k = 100 / basis; // the entered values are for `basis` g/ml: store them per 100
    const r1 = (n: number) => Math.round(n * 10) / 10;
    const portion = num(nPortion) > 0 ? { label: `1 portion (${num(nPortion)} ${nUnit})`, size: num(nPortion) } : undefined;
    const fd: Food = {
      key: code ? `my:${code}` : `my:${Date.now().toString(36)}`,
      name: nName.trim(),
      brand: nBrand.trim() || undefined,
      per: { kcal: Math.round(num(nKcal) * k), p: r1(num(nP) * k), c: r1(num(nC) * k), f: r1(num(nF) * k) },
      unit: nUnit,
      portion,
      src: 'custom',
      barcode: code || undefined,
      icon: nIcon,
    };
    EXTRAS.forEach((x, i) => { if (nX[i].trim()) fd.per[x.k] = Math.round(num(nX[i]) * k * 100) / 100; });
    if (editKey) {
      // the stored food stays as it was: the edited values become a new version of it; the quantity stays
      const same = nName.trim().toLowerCase() === (food?.name ?? '').toLowerCase();
      if (same) fd.name = `${nName.trim()} (${tr('edited')})`;
      fd.key = `my:${Date.now().toString(36)}`;
      fd.src = 'custom';
      saveFood(fd);
      setFood({ name: fd.name, brand: fd.brand, base: { ...fd.per, size: 100, unit: fd.unit }, fk: fd.key, portion: fd.portion, src: fd.src, icon: fd.icon, barcode: fd.barcode });
      setEditKey(null);
      setMode('qty');
      return;
    }
    saveFood(fd);
    pick(fd);
  };

  const title = { main: target.pick ? 'Choose a food' : 'Add food', scan: 'Scan barcode', quick: 'Quick add', qty: editing ? 'Edit quantity' : 'Add to log', create: editKey ? 'Edit nutrition' : 'Create food', icons: 'Choose a logo', label: 'Scan label', prev: 'Check the photo' }[mode];
  const back = () => {
    if (mode === 'main' || (mode === 'qty' && editing)) return onClose();
    if (mode === 'prev') return setMode('label');
    if (mode === 'icons') return setMode('create');
    if (mode === 'label') return setMode(labelFrom);
    if (mode === 'create') return setMode(createFrom);
    setMode('main');
  };
  const mealLabel = MEALS.find((m) => m.key === meal)!.label;

  return (
    <Modal visible animationType="slide" onRequestClose={back} statusBarTranslucent>
      <KbView style={{ flex: 1, backgroundColor: c.page }}>
        <View style={[s.head, { paddingTop: top + 10 }]}>
          <Pressable onPress={back} style={s.round} accessibilityLabel="Back"><Icon d={mode === 'main' ? P.x : P.back} size={20} /></Pressable>
          <View style={{ alignItems: 'center' }}>
            <Text style={s.h}>{title}</Text>
            {mode === 'main' && !target.pick && <Text style={s.headSub}>{mealLabel}</Text>}
          </View>
          {mode === 'icons' ? (
            <Pressable onPress={() => setIconEdit((v) => !v)} style={[s.editBtn, iconEdit && { backgroundColor: c.btn }]} accessibilityRole="button" accessibilityLabel="Edit logo names">
              <Text style={[s.editBtnT, iconEdit && { color: c.lime }]}>{iconEdit ? 'Done' : 'Edit'}</Text>
            </Pressable>
          ) : <View style={{ width: 42 }} />}
        </View>

        {mode === 'main' && (
          <>
            <View style={s.tabs}>
              {([['search', 'Search'], ['mine', 'My Foods'], ['recipes', 'Recipes'], ['meals', 'Meals']] as const).filter(([k]) => !(target.pick && (k === 'meals' || k === 'recipes'))).map(([k, l]) => (
                <Pressable key={k} onPress={() => setTab(k)} style={[s.tabB, tab === k && { backgroundColor: c.btn }]} accessibilityRole="button">
                  <Text style={[s.tabT, tab === k && { color: c.lime }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{l}</Text>
                </Pressable>
              ))}
            </View>

            {tab === 'search' && (
              <>
                <View style={s.searchRow}>
                  <TextInput
                    style={s.search}
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Search a food"
                    placeholderTextColor={c.soft}
                    returnKeyType="search"
                    selectionColor={c.lime}
                    autoCorrect={false}
                  />
                  <Pressable onPress={() => { setMiss(null); scanned.current = false; setMode('scan'); }} style={s.scanBtn} accessibilityLabel="Scan barcode"><Icon d={P.scan} size={22} /></Pressable>
                </View>
                <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: Math.max(bottom, 16) + 20 }}>
                  {query.trim().length === 0 && (
                    <>
                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        {!target.pick && (
                          <Pressable onPress={() => { setLabelMsg(''); setMode('quick'); }} style={[s.quick, card, { flex: 1 }]} accessibilityRole="button">
                            <Icon d={P.flame} size={18} color={c.limeText} sw={2.4} />
                            <Text style={s.quickT}>Quick add</Text>
                          </Pressable>
                        )}
                        <Pressable onPress={() => openCreate('main')} style={[s.quick, card, { flex: 1 }]} accessibilityRole="button">
                          <Icon d={P.plus} size={18} color={c.limeText} sw={2.6} />
                          <Text style={s.quickT}>Create food</Text>
                        </Pressable>
                      </View>
                      {recents.length > 0 && <Text style={s.sect}>Recent</Text>}
                      {recents.map((fd) => <FoodRow key={fd.key} food={fd} onPress={() => pick(fd)} />)}
                      {recents.length === 0 && <Text style={s.hint}>Type a food name, or scan a barcode.</Text>}
                    </>
                  )}
                  {query.trim().length === 1 && <Text style={s.hint}>Keep typing…</Text>}
                  {results.map((fd) => <FoodRow key={fd.key} food={fd} onPress={() => pick(fd)} />)}
                  {query.trim().length >= 2 && results.length === 0 && (
                    <>
                      <Text style={s.hint}>Nothing found for "{query}".</Text>
                      <Pressable onPress={() => openCreate('main', { name: query.trim() })} style={{ paddingVertical: 12 }}><Text style={s.link}>Create “{query.trim()}”</Text></Pressable>
                    </>
                  )}
                  {query.trim().length >= 2 && <Text style={s.credit}>Source: Anses, Table de composition nutritionnelle Ciqual 2025 (Licence Ouverte Etalab 2.0).</Text>}
                </ScrollView>
              </>
            )}

            {tab === 'mine' && (
              <View style={{ flex: 1 }}>
                <View style={s.mineHead}>
                  <Text style={s.hintS}>{mineSorted.length} food{mineSorted.length === 1 ? '' : 's'}{hiddenToday > 0 ? ` · ${hiddenToday} already logged today` : ''}</Text>
                  <Pressable onPress={() => openCreate('main')} accessibilityRole="button"><Text style={s.link}>+ Create food</Text></Pressable>
                </View>
                {mineSorted.length === 0 ? (
                  <Text style={[s.hint, { marginHorizontal: 20 }]}>{mine.length === 0 ? 'Foods you add, scan or create will be listed here, A to Z.' : 'Everything is already logged today.'}</Text>
                ) : (
                  <AlphaList foods={mineSorted} onPick={pick} bottom={Math.max(bottom, 16)} />
                )}
              </View>
            )}

            {tab === 'recipes' && (
              <>
                <View style={s.searchRow}>
                  <TextInput style={s.search} value={recQ} onChangeText={setRecQ} placeholder="Search a recipe or an ingredient" placeholderTextColor={c.soft} selectionColor={c.lime} autoCorrect={false} accessibilityLabel="Search recipes" />
                </View>
                <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: Math.max(bottom, 16) + 20 }}>
                  {state.recipes.length === 0 && <Text style={s.hint}>Your recipes will appear here: create one in the Recipes tab.</Text>}
                  {recipeList.map((r) => (
                    <Pressable key={r.id} onPress={() => addRecipe(r)} style={s.recRow} accessibilityRole="button" accessibilityLabel={r.title || 'Recipe'}>
                      <FoodIcon name="" icon="recipe" size={38} />
                      <View style={{ flex: 1 }}>
                        <Text style={s.recName} numberOfLines={1}>{r.title || 'Untitled recipe'}</Text>
                        <Text style={s.resSub} numberOfLines={1}>{r.cat === 'Draft' ? tr('Draft') : tr(r.cat)}</Text>
                      </View>
                      <Icon d={P.plus} size={18} color={c.limeText} sw={2.6} />
                    </Pressable>
                  ))}
                  {state.recipes.length > 0 && recipeList.length === 0 && <Text style={s.hint}>No recipe found.</Text>}
                </ScrollView>
              </>
            )}

            {tab === 'meals' && (
              <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: Math.max(bottom, 16) + 20, gap: 6 }}>
                <Text style={s.hintS}>{`Copy a meal from a previous day into ${mealLabel.toLowerCase()}.`}</Text>
                {blocks.length === 0 && <Text style={s.hint}>Meals you have logged will appear here, most recent first.</Text>}
                {blocks.map((b) => {
                  const label = MEALS.find((m) => m.key === b.meal)!.label;
                  return (
                    <View key={`${b.day}|${b.meal}`} style={[s.mealCard, card]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.mealDay}>{fmtDay(b.day)}</Text>
                          <Text style={s.resSub}>{label} · {fmt(sum(b.entries, 'kcal'))} kcal</Text>
                        </View>
                        <Pressable onPress={() => setCopyDlg(b.entries)} style={s.copyBtn} accessibilityRole="button" accessibilityLabel={`Copy ${label} of ${fmtDay(b.day)}`}>
                          <Text style={s.copyT}>Copy</Text>
                        </Pressable>
                      </View>
                      <View style={{ marginTop: 8 }}>
                        {b.entries.map((e) => (
                          <View key={e.id} style={s.mealItem}>
                            <FoodIcon name={e.name} size={26} />
                            <Text style={s.mealItemName} numberOfLines={1}>{e.name}</Text>
                            <Text style={s.mealItemKcal}>{fmt(e.kcal)}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            )}
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
                  onBarcodeScanned={miss ? undefined : onScan}
                  enableTorch={torch}
                />
                <TorchBtn on={torch} toggle={() => setTorch((x) => !x)} />
                <View style={s.frame} pointerEvents="none" />
                {busy && <ActivityIndicator color="#fff" size="large" style={StyleSheet.absoluteFill} />}
              </View>
            ) : (
              <View style={s.center}>
                <Text style={s.hint}>Allow the camera to scan barcodes.</Text>
                <Pressable onPress={askPerm} style={[s.cta, { alignSelf: 'stretch', marginTop: 16 }]}><Text style={s.ctaText}>Allow camera</Text></Pressable>
              </View>
            )}
            {miss ? (
              <View style={{ marginHorizontal: 20, gap: 10 }}>
                <Text style={s.err}>{miss.offline ? `Open Food Facts is not reachable, and ${miss.code} is not in your foods yet.` : `${miss.code} is not in your foods or in Open Food Facts.`}</Text>
                <Pressable onPress={() => openCreate('scan', { code: miss.code })} style={s.cta} accessibilityRole="button"><Text style={s.ctaText}>Create this food</Text></Pressable>
                <Pressable onPress={() => { setMiss(null); scanned.current = false; }} style={{ alignSelf: 'center', padding: 8 }}><Text style={s.link}>Scan again</Text></Pressable>
              </View>
            ) : (
              <Text style={[s.hint, { textAlign: 'center', marginTop: 14 }]}>Point the camera at a barcode.</Text>
            )}
            <Pressable onPress={() => setMode('main')} style={{ alignSelf: 'center', padding: 16, marginBottom: Math.max(bottom, 8) }}>
              <Text style={s.link}>Search by name instead</Text>
            </Pressable>
          </View>
        )}

        {mode === 'quick' && (
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 12 }}>
            <MealChips meal={meal} setMeal={setMeal} />
            <Pressable onPress={() => openLabel('quick')} style={[s.labelBtn, card]} accessibilityRole="button" accessibilityLabel="Autofill from a nutrition label">
              <Icon d={P.camera} size={20} color={c.limeText} sw={2.2} />
              <View style={{ flex: 1 }}>
                <Text style={s.quickT}>Autofill</Text>
                <Text style={s.resSub}>Photograph a nutrition label to fill the values</Text>
              </View>
            </Pressable>
            {labelMsg ? <Text style={[s.hintS, { color: /^Values/.test(labelMsg) ? c.limeText : c.red }]}>{labelMsg}</Text> : null}
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
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {EXTRAS.map((x, i) => (
                <View key={x.k} style={[s.macro, { flexBasis: '47%' }]}>
                  <Text style={s.macroL}>{x.label} (g, optional)</Text>
                  <TextInput style={s.macroIn} value={qX[i]} onChangeText={(t) => setQX((v) => v.map((y, j) => (j === i ? t : y)))} placeholder="—" placeholderTextColor={c.soft} keyboardType="decimal-pad" maxLength={5} selectionColor={c.lime} accessibilityLabel={x.label} />
                </View>
              ))}
            </View>
            <Pressable onPress={quickAdd} disabled={num(qKcal) <= 0} style={[s.cta, num(qKcal) <= 0 && { opacity: 0.35 }]}><Text style={s.ctaText}>Add to log</Text></Pressable>
          </ScrollView>
        )}

        {mode === 'create' && (
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: Math.max(bottom, 16) + 30 }}>
            {!editKey && (
              <Pressable onPress={() => openLabel('create')} style={[s.labelBtn, card]} accessibilityRole="button" accessibilityLabel="Scan nutrition label">
                <Icon d={P.camera} size={20} color={c.limeText} sw={2.2} />
                <View style={{ flex: 1 }}>
                  <Text style={s.quickT}>Scan the nutrition label</Text>
                  <Text style={s.resSub}>Photo read by Groq AI (your API key)</Text>
                </View>
              </Pressable>
            )}
            {labelMsg ? <Text style={[s.hintS, { color: /^Values|^Only/.test(labelMsg) ? c.limeText : c.red }]}>{labelMsg}</Text> : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Pressable onPress={() => { setIconQ(''); setMode('icons'); }} style={[s.iconPick, card]} accessibilityRole="button" accessibilityLabel="Choose a logo">
                <FoodIcon name={nName} icon={nIcon} size={52} />
                <Text style={s.iconPickT}>Change</Text>
              </Pressable>
              <TextInput
                style={[s.input, { flex: 1 }]}
                value={nName}
                onChangeText={(t) => { setNName(t); if (!nIconTouched) setNIcon(suggestIcon(t)); }}
                placeholder="Food name"
                placeholderTextColor={c.soft}
                maxLength={60}
                selectionColor={c.lime}
                autoFocus
              />
            </View>
            <TextInput style={s.input} value={nBrand} onChangeText={setNBrand} placeholder="Brand (optional)" placeholderTextColor={c.soft} maxLength={40} selectionColor={c.lime} />
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <Text style={s.fieldL}>Values per</Text>
              <TextInput style={s.basisIn} value={nBasis} onChangeText={setNBasis} keyboardType="decimal-pad" maxLength={6} selectTextOnFocus selectionColor={c.lime} accessibilityLabel="Quantity the values are for" />
              {(['g', 'ml'] as const).map((u) => (
                <Pressable key={u} onPress={() => setNUnit(u)} style={[s.mchip, nUnit === u && { backgroundColor: c.btn }]}>
                  <Text style={[s.mchipText, nUnit === u && { color: c.lime }]}>{u}</Text>
                </Pressable>
              ))}
            </View>
            <View style={s.kcalBox}>
              <TextInput style={s.kcalInput} value={nKcal} onChangeText={setNKcal} placeholder="0" placeholderTextColor={c.soft} keyboardType="decimal-pad" maxLength={5} selectionColor={c.lime} />
              <Text style={s.unit}>kcal</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {([['Protein', nP, setNP], ['Carbs', nC, setNC], ['Fat', nF, setNF]] as const).map(([l, v, set]) => (
                <View key={l} style={s.macro}>
                  <Text style={s.macroL}>{l} (g)</Text>
                  <TextInput style={s.macroIn} value={v} onChangeText={set} placeholder="0" placeholderTextColor={c.soft} keyboardType="decimal-pad" maxLength={5} selectionColor={c.lime} />
                </View>
              ))}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {EXTRAS.map((x, i) => (
                <View key={x.k} style={[s.macro, { flexBasis: '47%' }]}>
                  <Text style={s.macroL}>{x.label} (g, optional)</Text>
                  <TextInput style={s.macroIn} value={nX[i]} onChangeText={(t) => setNX((v) => v.map((y, j) => (j === i ? t : y)))} placeholder="—" placeholderTextColor={c.soft} keyboardType="decimal-pad" maxLength={5} selectionColor={c.lime} accessibilityLabel={x.label} />
                </View>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={[s.macro, { flex: 1 }]}>
                <Text style={s.macroL}>1 portion ({nUnit}, optional)</Text>
                <TextInput style={s.macroIn} value={nPortion} onChangeText={setNPortion} placeholder="—" placeholderTextColor={c.soft} keyboardType="decimal-pad" maxLength={5} selectionColor={c.lime} />
              </View>
              <View style={[s.macro, { flex: 1.3 }]}>
                <Text style={s.macroL}>Barcode (optional)</Text>
                <TextInput style={s.macroIn} value={nCode} onChangeText={setNCode} placeholder="—" placeholderTextColor={c.soft} keyboardType="number-pad" maxLength={14} selectionColor={c.lime} />
              </View>
            </View>
            <Pressable onPress={createFood} disabled={!createOk} style={[s.cta, !createOk && { opacity: 0.35 }]} accessibilityRole="button"><Text style={s.ctaText}>{editKey ? 'Save changes' : 'Save food'}</Text></Pressable>
          </ScrollView>
        )}

        {mode === 'label' && (
          <View style={{ flex: 1 }}>
            <View style={s.camWrap}>
              <CameraView ref={cam} style={StyleSheet.absoluteFill} facing="back" enableTorch={torch} />
              <View style={s.labelFrame} pointerEvents="none" />
              <TorchBtn on={torch} toggle={() => setTorch((x) => !x)} />
              {labelBusy && (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', gap: 12 }]}>
                  <ActivityIndicator color="#fff" size="large" />
                  <Text style={{ fontFamily: f.bold, color: '#fff' }}>Reading the label…</Text>
                </View>
              )}
            </View>
            {labelMsg ? <Text style={[s.err, { marginHorizontal: 20, marginTop: 0 }]}>{labelMsg}</Text> : <Text style={[s.hint, { textAlign: 'center', marginTop: 0, marginHorizontal: 20 }]}>Fit the whole nutrition table in the frame, then take the photo. The photo is sent to Groq and not kept.</Text>}
            <View style={{ alignItems: 'center', justifyContent: 'center', marginBottom: Math.max(bottom, 12) + 8 }}>
              <Pressable onPress={snapLabel} style={s.shutter} accessibilityRole="button" accessibilityLabel="Take photo"><View style={s.shutterIn} /></Pressable>
              <Pressable onPress={openGallery} style={[s.galBtn]} accessibilityRole="button" accessibilityLabel="Pick from the gallery"><Icon d={P.image} size={26} color={c.ink} sw={2.2} /></Pressable>
            </View>
          </View>
        )}

        {mode === 'prev' && shot && (
          <View style={{ flex: 1 }}>
            <View style={s.camWrap}>
              <Image source={{ uri: shot.uri }} style={StyleSheet.absoluteFill} resizeMode="contain" />
              {res && (
                <View style={s.readout} pointerEvents="none">
                  <Text style={s.roTitle}>{res.name.trim() ? res.name.trim() : 'Nutrition label found'}</Text>
                  <Text style={s.roSub}>{res.note || 'Values per 100 g'}</Text>
                  {([
                    ['Calories', res.kcal, 'kcal', false], ['Protein', res.p, 'g', false], ['Carbs', res.c, 'g', false],
                    ['Sugar', res.x[0], 'g', true], ['Fat', res.f, 'g', false], ['Saturated fat', res.x[3], 'g', true],
                    ['Fiber', res.x[2], 'g', true], ['Salt', res.x[1], 'g', false],
                  ] as const).map(([l, v, u, sub]) => (
                    <View key={l} style={s.roRow}>
                      <Text style={[s.roL, sub && { paddingLeft: 14, opacity: 0.85 }]}>{l}</Text>
                      <Text style={s.roV}>{v === '' ? '—' : `${v} ${u}`}</Text>
                    </View>
                  ))}
                </View>
              )}
              {labelBusy && (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', gap: 12 }]}>
                  <ActivityIndicator color="#fff" size="large" />
                  <Text style={{ fontFamily: f.bold, color: '#fff' }}>Reading the label…</Text>
                </View>
              )}
            </View>
            {labelMsg ? <Text style={[s.err, { marginHorizontal: 20, marginTop: 0 }]}>{labelMsg}</Text> : <Text style={[s.hint, { textAlign: 'center', marginTop: 0, marginHorizontal: 20 }]}>{res ? 'Check the values against the photo. You can edit them on the next screen.' : 'Is the table sharp and fully visible? If not, retake the photo before sending.'}</Text>}
            <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 20, marginTop: 14, marginBottom: Math.max(bottom, 12) + 8 }}>
              <Pressable onPress={() => { setLabelMsg(''); setRes(null); setMode('label'); }} disabled={labelBusy} style={[s.prevBtn, card, labelBusy && { opacity: 0.4 }]} accessibilityRole="button" accessibilityLabel="Retake"><Text style={s.quickT}>Retake</Text></Pressable>
              <Pressable onPress={openGallery} disabled={labelBusy} style={[s.prevBtn, card, labelBusy && { opacity: 0.4 }]} accessibilityRole="button" accessibilityLabel="Other photo"><Text style={s.quickT}>Gallery</Text></Pressable>
              {res ? (
                <Pressable onPress={useScanned} disabled={labelBusy} style={[s.prevBtn, { backgroundColor: c.lime }]} accessibilityRole="button" accessibilityLabel="Continue"><Text style={[s.quickT, { color: c.onLime }]}>Continue</Text></Pressable>
              ) : (
                <Pressable onPress={sendLabel} disabled={labelBusy} style={[s.prevBtn, { backgroundColor: c.lime }, labelBusy && { opacity: 0.4 }]} accessibilityRole="button" accessibilityLabel="Send"><Text style={[s.quickT, { color: c.onLime }]}>Send</Text></Pressable>
              )}
            </View>
          </View>
        )}

        {mode === 'icons' && (
          <View style={{ flex: 1 }}>
            <TextInput style={[s.input, { marginHorizontal: 20, marginBottom: 8 }]} value={iconQ} onChangeText={setIconQ} placeholder="Filter (English or French names)" placeholderTextColor={c.soft} selectionColor={c.lime} autoCorrect={false} />
            {iconEdit && <Text style={[s.hintS, { marginHorizontal: 20, marginBottom: 6 }]}>Tap a logo to rename it or remove its name.</Text>}
            <FlatList
              data={iconList}
              keyExtractor={(i) => i.key}
              numColumns={4}
              contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: Math.max(bottom, 16) + 20 }}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable onPress={() => { if (iconEdit) { setRenIcon({ key: item.key, name: iconLabel(item.key, item.name) }); return; } setNIcon(item.key); setNIconTouched(true); setMode('create'); }} style={[s.iconCell, !iconEdit && nIcon === item.key && { backgroundColor: c.tint }]} accessibilityLabel={iconLabel(item.key, item.name) || item.name}>
                  <FoodIcon name="" icon={item.key} size={48} />
                  <Text style={s.iconCellT} numberOfLines={2}>{iconLabel(item.key, item.name)}</Text>
                </Pressable>
              )}
            />
          </View>
        )}
        <Modal visible={!!renIcon} transparent animationType="fade" onRequestClose={() => setRenIcon(null)} statusBarTranslucent>
          <KbView style={s.renWrap}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setRenIcon(null)} accessibilityLabel="Close" />
            {renIcon && (
              <View style={[s.renBox, { backgroundColor: c.card }]}>
                <View style={{ alignItems: 'center' }}><FoodIcon name="" icon={renIcon.key} size={64} /></View>
                <TextInput style={s.input} value={renIcon.name} onChangeText={(v) => setRenIcon({ ...renIcon, name: v })} placeholder="Logo name" placeholderTextColor={c.soft} selectionColor={c.lime} autoFocus maxLength={40} accessibilityLabel="Logo name" />
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Pressable onPress={() => { setSettings({ iconNames: { ...iconNames, [renIcon.key]: '' } }); setRenIcon(null); }} style={[s.renBtn, { backgroundColor: c.page }]} accessibilityRole="button"><Text style={[s.renT, { color: c.red }]}>Remove name</Text></Pressable>
                  <Pressable onPress={() => { const n = { ...iconNames }; delete n[renIcon.key]; setSettings({ iconNames: n }); setRenIcon(null); }} style={[s.renBtn, { backgroundColor: c.page }]} accessibilityRole="button"><Text style={[s.renT, { color: c.ink }]}>Reset</Text></Pressable>
                </View>
                <Pressable onPress={() => { setSettings({ iconNames: { ...iconNames, [renIcon.key]: renIcon.name.trim() } }); setRenIcon(null); }} style={s.renSave} accessibilityRole="button"><Text style={[s.renT, { color: c.lime }]}>Save</Text></Pressable>
              </View>
            )}
          </KbView>
        </Modal>

        {mode === 'qty' && food && totals && (
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: Math.max(bottom, 16) + 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <FoodIcon name={food.name} icon={food.icon} size={56} />
              <View style={{ flex: 1 }}>
                <Text style={s.foodName}>{food.name}</Text>
                {food.brand ? <Text style={s.resSub}>{food.brand}</Text> : null}
              </View>
              {food.fk && food.base.size === 100 && (
                <Pressable onPress={openEdit} style={s.pencil} hitSlop={6} accessibilityRole="button" accessibilityLabel="Edit nutrition values"><Icon d={P.edit} size={18} color={c.limeText} sw={2.2} /></Pressable>
              )}
            </View>
            {!editing && <MealChips meal={meal} setMeal={setMeal} />}
            <View style={[s.qtyBox, card]}>
              <Pressable onPress={() => setQty(String(Math.max(0, +(q - step).toFixed(2))))} style={s.stepper} hitSlop={6} accessibilityLabel="Less"><Icon d={P.minus} size={20} sw={2.6} /></Pressable>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center' }}>
                <TextInput style={s.qtyIn} value={qty} onChangeText={setQty} keyboardType="decimal-pad" maxLength={6} selectionColor={c.lime} selectTextOnFocus accessibilityLabel="Quantity" />
                <Text style={s.unit}>{unitLabel(food.base.unit, q)}</Text>
              </View>
              <Pressable onPress={() => setQty(String(+(q + step).toFixed(2)))} style={[s.stepper, { backgroundColor: c.btn }]} hitSlop={6} accessibilityLabel="More"><Icon d={P.plus} size={20} sw={2.6} color={c.lime} /></Pressable>
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
              {EXTRAS.some((x) => totals[x.k] != null) && (
                <Text style={s.sumMacros}>{EXTRAS.filter((x) => totals[x.k] != null).map((x) => `${x.label.toLowerCase()} ${Math.round((totals[x.k] as number) * 10) / 10} g`).join(' · ')}</Text>
              )}
            </View>
            <Pressable onPress={save} disabled={q <= 0} style={[s.cta, q <= 0 && { opacity: 0.35 }]} accessibilityRole="button">
              <Text style={s.ctaText}>{editing ? 'Save' : `Add to ${mealLabel.toLowerCase()}`}</Text>
            </Pressable>
            {editing && (
              <Pressable onPress={() => { removeEntry(editing.id); onClose(); }} style={{ alignSelf: 'center', padding: 12 }} accessibilityRole="button">
                <Text style={[s.link, { color: c.red }]}>Remove from log</Text>
              </Pressable>
            )}
          </ScrollView>
        )}
      </KbView>
      <FactorModal
        visible={!!copyDlg}
        title="Copy this meal"
        confirm={`Copy into ${mealLabel.toLowerCase()}`}
        kcal={copyDlg ? sum(copyDlg, 'kcal') : 0}
        onClose={() => setCopyDlg(null)}
        onApply={(k) => copyDlg && copyBlock(copyDlg, k)}
      />
    </Modal>
  );
}

function TorchBtn({ on, toggle }: { on: boolean; toggle: () => void }) {
  return (
    <Pressable onPress={toggle} style={[s.torch, on && { backgroundColor: c.lime }]} hitSlop={8} accessibilityRole="button" accessibilityLabel={on ? 'Turn flashlight off' : 'Turn flashlight on'}>
      <Icon d={P.zap} size={22} color={on ? c.ink : '#fff'} fill={on ? c.ink : 'none'} sw={2.2} />
    </Pressable>
  );
}

function MealChips({ meal, setMeal }: { meal: MealKey; setMeal: (m: MealKey) => void }) {
  const { state } = useStore();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ flexGrow: 0, flexShrink: 1, maxWidth: '100%', alignSelf: 'stretch' }} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
      {MEALS.filter((m) => m.key === meal || state.settings.meals.includes(m.key)).map((m) => (
        <Pressable key={m.key} onPress={() => setMeal(m.key)} style={[s.mchip, meal === m.key && { backgroundColor: c.btn }]}>
          <Text style={[s.mchipText, meal === m.key && { color: c.lime }]}>{m.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const mkStyles = () => StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 10 },
  renWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  renBox: { borderRadius: 26, padding: 18, gap: 12 },
  renBtn: { flex: 1, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  renSave: { height: 50, borderRadius: 25, backgroundColor: c.btn, alignItems: 'center', justifyContent: 'center' },
  renT: { fontFamily: f.bold, fontSize: 14.5 },
  editBtn: { ...card, minWidth: 42, height: 42, borderRadius: 21, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  editBtnT: { fontFamily: f.bold, fontSize: 13.5, color: c.ink },
  round: { width: 42, height: 42, borderRadius: 21, ...card, alignItems: 'center', justifyContent: 'center' },
  h: { fontFamily: f.extra, fontSize: 20, color: c.ink, letterSpacing: -0.4 },
  headSub: { fontFamily: f.semi, fontSize: 12.5, color: c.muted, marginTop: 1 },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginBottom: 12 },
  tabB: { ...card, flex: 1, borderRadius: 20, paddingVertical: 10, paddingHorizontal: 2, alignItems: 'center' },
  recRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  recName: { fontFamily: f.medium, fontSize: 15.5, color: c.ink },
  tabT: { fontFamily: f.bold, fontSize: 12.5, color: c.ink },
  searchRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 8 },
  search: { ...card, flex: 1, borderRadius: 22, paddingHorizontal: 18, height: 52, fontFamily: f.medium, fontSize: 16, color: c.ink },
  scanBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: c.lime, alignItems: 'center', justifyContent: 'center' },
  quick: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 8 },
  quickT: { fontFamily: f.bold, fontSize: 14.5, color: c.limeText },
  sect: { fontFamily: f.extra, fontSize: 16, color: c.ink, marginTop: 18, marginBottom: 2 },
  hint: { fontFamily: f.regular, fontSize: 14.5, color: c.muted, marginTop: 18, lineHeight: 21 },
  hintS: { fontFamily: f.medium, fontSize: 13, color: c.muted },
  err: { fontFamily: f.medium, fontSize: 14, color: c.red, marginTop: 18, lineHeight: 20 },
  credit: { fontFamily: f.regular, fontSize: 11.5, color: c.soft, marginTop: 20, textAlign: 'center' },
  res: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.line },
  resName: { fontFamily: f.semi, fontSize: 15, color: c.ink },
  resSub: { fontFamily: f.regular, fontSize: 12.5, color: c.muted, marginTop: 2 },
  resKcal: { fontFamily: f.extra, fontSize: 16, color: c.ink },
  mineHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 8 },
  letterHead: { height: HEAD_H, justifyContent: 'flex-end', paddingBottom: 4 },
  letterHeadT: { fontFamily: f.extra, fontSize: 15, color: c.limeText },
  bar: { position: 'absolute', right: 0, top: 4, bottom: 8, width: 30, paddingVertical: 2 },
  barL: { fontFamily: f.bold, fontSize: 10.5, color: c.muted, lineHeight: 13 },
  bubble: { position: 'absolute', right: 48, top: '40%', width: 64, height: 64, borderRadius: 32, backgroundColor: c.btn, alignItems: 'center', justifyContent: 'center' },
  bubbleT: { fontFamily: f.extra, fontSize: 28, color: c.lime },
  mealCard: { borderRadius: 22, padding: 14 },
  mealDay: { fontFamily: f.extra, fontSize: 16, color: c.ink },
  copyBtn: { backgroundColor: c.tint, borderRadius: 18, paddingHorizontal: 18, paddingVertical: 9 },
  copyT: { fontFamily: f.bold, fontSize: 13.5, color: c.limeText },
  mealItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  mealItemName: { flex: 1, fontFamily: f.medium, fontSize: 13.5, color: c.ink },
  mealItemKcal: { fontFamily: f.bold, fontSize: 13.5, color: c.muted },
  camWrap: { flex: 1, margin: 20, borderRadius: 28, overflow: 'hidden', backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  frame: { width: 260, height: 150, borderRadius: 20, borderWidth: 3, borderColor: c.lime },
  center: { flex: 1, padding: 30, justifyContent: 'center' },
  link: { fontFamily: f.bold, fontSize: 14, color: c.limeText },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  mchip: { ...card, borderRadius: 20, paddingHorizontal: 13, paddingVertical: 9 },
  mchipText: { fontFamily: f.bold, fontSize: 13, color: c.ink },
  input: { ...card, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 13, fontFamily: f.medium, fontSize: 15, color: c.ink },
  fieldL: { fontFamily: f.semi, fontSize: 13.5, color: c.muted, marginRight: 4 },
  torch: { position: 'absolute', top: 14, right: 14, width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  labelBtn: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  labelFrame: { width: '86%', height: '70%', borderRadius: 20, borderWidth: 3, borderColor: c.lime },
  shutter: { alignSelf: 'center', width: 74, height: 74, borderRadius: 37, borderWidth: 4, borderColor: c.btn, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  resPhoto: { height: 170, borderRadius: 20, backgroundColor: '#000' },
  resTitle: { fontFamily: f.extra, fontSize: 20, color: c.ink },
  resCard: { borderRadius: 20, paddingHorizontal: 16 },
  resRow: { flexDirection: 'row', alignItems: 'center', minHeight: 50, gap: 8 },
  resLab: { fontFamily: f.semi, fontSize: 15, color: c.ink, minWidth: 110 },
  resVal: { flex: 1, textAlign: 'right', fontFamily: f.extra, fontSize: 16, color: c.ink, paddingVertical: 8 },
  resUnit: { fontFamily: f.semi, fontSize: 14, color: c.muted, width: 34 },
  basisIn: { minWidth: 64, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, borderRadius: 14, paddingHorizontal: 10, height: 36, textAlign: 'center', fontFamily: f.extra, fontSize: 15, color: c.ink },
  readout: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '50%', backgroundColor: 'rgba(0,0,0,0.75)', paddingHorizontal: 18, paddingVertical: 12, justifyContent: 'center' },
  roTitle: { fontFamily: f.extra, fontSize: 16, color: '#fff', textShadowColor: 'rgba(0,0,0,0.9)', textShadowRadius: 4 },
  roSub: { fontFamily: f.semi, fontSize: 12, color: '#fff', marginBottom: 6, textShadowColor: 'rgba(0,0,0,0.9)', textShadowRadius: 4 },
  roRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  roL: { fontFamily: f.semi, fontSize: 14, color: '#fff', textShadowColor: 'rgba(0,0,0,0.9)', textShadowRadius: 4 },
  roV: { fontFamily: f.extra, fontSize: 14, color: '#fff', textShadowColor: 'rgba(0,0,0,0.9)', textShadowRadius: 4 },
  galBtn: { position: 'absolute', left: 28, width: 56, height: 56, borderRadius: 28, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: c.lime },
  prevBtn: { flex: 1, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  shutterIn: { width: 54, height: 54, borderRadius: 27, backgroundColor: c.lime },
  pencil: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.tint, alignItems: 'center', justifyContent: 'center' },
  iconPick: { width: 84, borderRadius: 20, paddingVertical: 8, alignItems: 'center' },
  iconPickT: { fontFamily: f.bold, fontSize: 11.5, color: c.limeText, marginTop: 2 },
  iconCell: { width: '25%', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 2, borderRadius: 16 },
  iconCellT: { fontFamily: f.medium, fontSize: 10.5, color: c.muted, textAlign: 'center', marginTop: 3 },
  kcalBox: { ...card, borderRadius: 22, paddingHorizontal: 18, paddingVertical: 8, flexDirection: 'row', alignItems: 'baseline' },
  kcalInput: { flex: 1, minWidth: 0, fontFamily: f.extra, fontSize: 32, color: c.ink, letterSpacing: -0.8 },
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
  sumBig: { fontFamily: f.extra, fontSize: 34, color: c.onLime, letterSpacing: -1 },
  sumUnit: { fontFamily: f.bold, fontSize: 15, letterSpacing: 0 },
  sumMacros: { fontFamily: f.semi, fontSize: 13, color: c.onLime, opacity: 0.8, marginTop: 4 },
  cta: { height: 56, borderRadius: 28, backgroundColor: c.btn, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontFamily: f.bold, fontSize: 16, color: c.lime },
});
let s = mkStyles();
onTheme(() => { s = mkStyles(); });
