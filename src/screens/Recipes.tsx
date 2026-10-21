import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Keyboard,  Modal, PanResponder, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { askConfirm, notify } from '../dialog';
import { Text, TextInput, tr } from '../i18n';
import { Linking } from 'react-native';
import { norm } from '../foods';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { c, f, onTheme } from '../theme';
import { fmt } from '../domain';
import type { Food } from '../foods';
import { FoodIcon } from '../foodIcons';
import { convertRecipe, DRAFT, newId, type Converted, type Ingredient, type Recipe } from '../recipes';
import { DEFAULT_MODEL } from '../vision';
import { useStore } from '../store';
import { card, Disc, Icon, P, Screen, Title, KbView } from '../ui';

export type RecipeRequest = { n: number; kind: 'new' | 'import'; cat?: string } | null;
/** Opens the food search / scan / create screen to choose a food; `onPick` receives it. */
export type PickFood = (o: { query?: string; scan?: boolean; create?: boolean; onPick: (fd: Food) => void }) => void;

const per100 = (fd: Food | undefined, g: number) => (fd ? { kcal: (fd.per.kcal * g) / 100, p: (fd.per.p * g) / 100, c: (fd.per.c * g) / 100, f: (fd.per.f * g) / 100 } : null);

/** Nutrition of the ingredients that are linked to a food of the user's database. */
function totalsOf(ings: Ingredient[], foods: Record<string, Food>) {
  let linked = 0;
  const t = { kcal: 0, p: 0, c: 0, f: 0 };
  for (const i of ings) {
    const n = i.fk ? per100(foods[i.fk], i.g) : null;
    if (!n) continue;
    linked++;
    t.kcal += n.kcal; t.p += n.p; t.c += n.c; t.f += n.f;
  }
  return { ...t, linked };
}

const CAT_ICON: Record<string, string[]> = { Breakfast: P.coffee, 'Main dish': P.meals, Dessert: P.cookie, Other: P.apple, [DRAFT]: P.edit };
const CAT_BG: Record<string, string> = { Breakfast: '#FF9F43', 'Main dish': '#22B5A3', Dessert: '#F2688A', Other: '#7DC242', [DRAFT]: '#8E8E93' };
const catIcon = (cat: string) => CAT_ICON[cat] ?? P.apple;
const catBg = (cat: string) => CAT_BG[cat] ?? '#5B5BD6';

/* ───────────────────────────── list screen ───────────────────────────── */

export function Recipes({ request, onConsumed, onPickFood }: { request: RecipeRequest; onConsumed: () => void; onPickFood: PickFood }) {
  const { state } = useStore();
  const { recipes, recipeCats } = state;
  const [open, setOpen] = useState<Recipe | null>(null);
  const [importing, setImporting] = useState(false);
  const [review, setReview] = useState<{ text: string; conv: Converted } | null>(null);
  const [cats, setCats] = useState(false);
  const [searching, setSearching] = useState(false);
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!request) return;
    if (request.kind === 'import') setImporting(true);
    else setOpen({ id: newId(), title: '', cat: request.cat ?? recipeCats[0], ingredients: [], steps: '', servings: 1, created: Date.now() });
    onConsumed(); // handled once: otherwise coming back to this tab would re-open the popup
  }, [request?.n]); // eslint-disable-line react-hooks/exhaustive-deps

  const groups = useMemo(() => {
    const k = q.trim().toLowerCase();
    return recipeCats
      .map((cat) => ({ cat, list: recipes.filter((r) => r.cat === cat && (!k || (r.title || '').toLowerCase().includes(k) || r.ingredients.some((i) => i.name.toLowerCase().includes(k)))) }))
      .filter((g) => !k || g.list.length > 0);
  }, [recipes, recipeCats, q]);

  return (
    <Screen>
      <View style={s.head}>
        <Title>Recipes</Title>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable onPress={() => { setSearching((v) => !v); setQ(''); }} style={s.gear} hitSlop={8} accessibilityRole="button" accessibilityLabel="Search recipes"><Icon d={searching ? P.x : P.search} size={20} color={c.ink} /></Pressable>
          <Pressable onPress={() => setCats(true)} style={s.gear} hitSlop={8} accessibilityRole="button" accessibilityLabel="Edit categories"><Icon d={P.edit} size={20} color={c.ink} /></Pressable>
        </View>
      </View>
      {searching && (
        <TextInput style={[s.field, s.searchIn]} value={q} onChangeText={setQ} placeholder="Search a recipe or an ingredient" placeholderTextColor={c.soft} selectionColor={c.lime} autoFocus accessibilityLabel="Search recipes" />
      )}
      {recipes.length === 0 && <Text style={s.empty}>No recipes yet. Tap the green + to add one or to import one from Instagram.</Text>}
      {searching && q.trim() && groups.length === 0 && <Text style={s.empty}>No recipe found.</Text>}
      {groups.map(({ cat, list }) => (
        <View key={cat} style={[s.group, card]}>
          <View style={s.catRow}>
            <Disc d={catIcon(cat)} bg={catBg(cat)} size={30} />
            <Text style={s.catName}>{cat}</Text>
            <Text style={s.catCount}>{list.length}</Text>
          </View>
          {list.length === 0 ? <Text style={s.catEmpty}>Empty</Text> : list.map((r) => (
            <Pressable key={r.id} onPress={() => setOpen(r)} style={[s.recipe, { borderTopWidth: 1, borderTopColor: c.line }]} accessibilityRole="button" accessibilityLabel={r.title || 'Recipe'}>
              <Text style={[s.rTitle, { flex: 1 }]} numberOfLines={1}>{r.title || 'Untitled recipe'}</Text>
              {r.source === 'instagram' && <Text style={s.badge}>Instagram</Text>}
              <Icon d={P.next} size={16} color={c.soft} />
            </Pressable>
          ))}
        </View>
      ))}
      <ImportModal visible={importing} onClose={() => setImporting(false)} onDone={(text, conv) => { setImporting(false); setReview({ text, conv }); }} />
      <ReviewModal data={review} onClose={() => setReview(null)} onSaved={(r) => { setReview(null); setOpen(r); }} />
      <RecipeDetail recipe={open} onClose={() => setOpen(null)} onPickFood={onPickFood} />
      <CatManager visible={cats} onClose={() => setCats(false)} />
    </Screen>
  );
}

/* ───────────────────────────── "+" sheet ───────────────────────────── */

/** The "+" menu of the Recipes tab: which kind of recipe to add, or import one from Instagram. */
export function RecipeSheet({ visible, onClose, onNew, onImport }: { visible: boolean; onClose: () => void; onNew: (cat: string) => void; onImport: () => void }) {
  const { state } = useStore();
  const { bottom } = useSafeAreaInsets();
  // the sheet slides up while the backdrop only fades (Modal's own "slide" would drag the dark backdrop up too)
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
  return (
    <Modal visible={show} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, s.backdrop, { opacity: fade }]} />
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      <Animated.View style={[s.sheet, { paddingBottom: Math.max(bottom, 16) + 12, transform: [{ translateY: y }] }]}>
        <View style={s.grab} />
        <Text style={s.sheetT}>Add a recipe</Text>
        <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: 4 }}>
          <Pressable onPress={() => { onClose(); onImport(); }} style={s.sRow} accessibilityRole="button" accessibilityLabel="Import from Instagram">
            <Disc d={P.camera} bg="#C13584" size={44} />
            <View style={{ flex: 1 }}>
              <Text style={s.sName}>Import from Instagram</Text>
            </View>
          </Pressable>
          {state.recipeCats.filter((k) => k !== DRAFT).map((cat) => (
            <Pressable key={cat} onPress={() => { onClose(); onNew(cat); }} style={s.sRow} accessibilityRole="button" accessibilityLabel={`New ${cat}`}>
              <Disc d={catIcon(cat)} bg={catBg(cat)} size={44} />
              <View style={{ flex: 1 }}>
                <Text style={s.sName}>{cat}</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

/* ───────────────────────────── Instagram import ───────────────────────────── */

function ImportModal({ visible, onClose, onDone }: { visible: boolean; onClose: () => void; onDone: (text: string, conv: Converted) => void }) {
  const { state } = useStore();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { if (visible) { setText(''); setErr(''); setBusy(false); } }, [visible]);
  const go = async () => {
    if (busy) return;
    if (!state.settings.groqKey.trim()) return setErr('Add your Groq API key first: Profile → AI label scan.');
    setBusy(true); setErr('');
    try {
      const conv = await convertRecipe(text.trim(), state.settings.groqKey.trim(), state.settings.groqModel.trim() || DEFAULT_MODEL);
      onDone(text.trim(), conv);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'The recipe could not be converted.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KbView style={s.mWrap}>
        <Pressable style={StyleSheet.absoluteFill} onPress={busy ? undefined : onClose} accessibilityLabel="Close" />
        <View style={s.mCard}>
          <Text style={s.mTitle}>Import from Instagram</Text>
          <Text style={s.hint}>On the post, copy the description (caption), then paste it here. Qwen converts the whole recipe to grams and lists each ingredient.</Text>
          <TextInput style={s.area} value={text} onChangeText={setText} multiline placeholder="Paste the description here…" placeholderTextColor={c.soft} selectionColor={c.lime} textAlignVertical="top" editable={!busy} accessibilityLabel="Recipe description" />
          {err ? <Text style={s.err}>{err}</Text> : null}
          <Pressable onPress={go} disabled={busy || text.trim().length < 15} style={[s.cta, (busy || text.trim().length < 15) && { opacity: 0.4 }]} accessibilityRole="button">
            {busy ? <ActivityIndicator color={c.lime} /> : <Text style={s.ctaT}>Convert to grams</Text>}
          </Pressable>
          <Pressable onPress={onClose} disabled={busy} style={{ alignSelf: 'center', padding: 6 }} accessibilityRole="button"><Text style={s.link}>Cancel</Text></Pressable>
        </View>
      </KbView>
    </Modal>
  );
}

/* ───────────────────────────── ingredient dialog ───────────────────────────── */

function IngredientDialog({ ing, onClose, onSave, onDelete }: { ing: Ingredient | null; onClose: () => void; onSave: (i: Ingredient) => void; onDelete: () => void }) {
  const { state } = useStore();
  const [name, setName] = useState('');
  const [g, setG] = useState('');
  useEffect(() => { if (ing) { setName(ing.name); setG(ing.g ? String(ing.g) : ''); } }, [ing]);
  const gv = parseFloat(g.replace(',', '.'));
  const ok = name.trim().length > 0 && Number.isFinite(gv) && gv >= 0;
  return (
    <Modal visible={!!ing} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KbView style={s.mWrap}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <View style={s.mCard}>
          <Text style={s.mTitle}>Ingredient</Text>
          {ing?.orig ? <Text style={s.hint}>{`In the post: ${ing.orig}`}</Text> : null}
          {ing?.fk && state.foods[ing.fk] ? (
            <View style={s.linked}>
              <Text style={[s.hint, { flex: 1 }]} numberOfLines={1}>{`Linked to ${state.foods[ing.fk].name}`}</Text>
              <Pressable onPress={() => onSave({ ...ing, name: name.trim() || ing.name, g: Number.isFinite(gv) ? gv : ing.g, fk: undefined })} hitSlop={8} accessibilityRole="button"><Text style={s.link}>Unlink</Text></Pressable>
            </View>
          ) : null}
          <Text style={s.fieldL}>Name</Text>
          <TextInput style={s.field} value={name} onChangeText={setName} selectionColor={c.lime} accessibilityLabel="Ingredient name" />
          <Text style={s.fieldL}>Quantity (g)</Text>
          <TextInput style={s.field} value={g} onChangeText={setG} keyboardType="decimal-pad" selectTextOnFocus selectionColor={c.lime} accessibilityLabel="Ingredient grams" />
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
            <Pressable onPress={onDelete} style={[s.smallBtn, { backgroundColor: c.page }]} accessibilityRole="button" accessibilityLabel="Delete ingredient"><Icon d={P.trash} size={20} color={c.red} /></Pressable>
            <Pressable onPress={() => ing && ok && onSave({ ...ing, name: name.trim(), g: Math.round(gv * 10) / 10 })} disabled={!ok} style={[s.cta, { flex: 1, marginTop: 0 }, !ok && { opacity: 0.4 }]} accessibilityRole="button"><Text style={s.ctaT}>Save</Text></Pressable>
          </View>
        </View>
      </KbView>
    </Modal>
  );
}

function Servings({ value, onChange }: { value: number | undefined; onChange: (n: number) => void }) {
  const v = value && value > 0 ? value : 1;
  const set = (n: number) => onChange(Math.max(1, Math.min(99, Math.round(n))));
  return (
    <View style={s.servRow}>
      <Text style={s.servL}>Servings</Text>
      <Pressable onPress={() => set(v - 1)} style={s.servB} hitSlop={6} accessibilityRole="button" accessibilityLabel="Fewer servings"><Icon d={P.minus} size={18} /></Pressable>
      <TextInput style={s.servIn} value={String(v)} onChangeText={(t) => { const n = parseInt(t.replace(/\D/g, ''), 10); if (Number.isFinite(n)) set(n); }} keyboardType="number-pad" maxLength={2} selectTextOnFocus selectionColor={c.lime} accessibilityLabel="Servings" />
      <Pressable onPress={() => set(v + 1)} style={s.servB} hitSlop={6} accessibilityRole="button" accessibilityLabel="More servings"><Icon d={P.plus} size={18} /></Pressable>
    </View>
  );
}

/* ───────────────────────────── review (2 columns) ───────────────────────────── */

function ReviewModal({ data, onClose, onSaved }: { data: { text: string; conv: Converted } | null; onClose: () => void; onSaved: (r: Recipe) => void }) {
  const { saveRecipe } = useStore();
  const { top, bottom } = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [ings, setIngs] = useState<Ingredient[]>([]);
  const [edit, setEdit] = useState<Ingredient | null>(null);
  const [right, setRight] = useState<'orig' | 'conv'>('orig');
  const [serv, setServ] = useState(1);
  const [creator, setCreator] = useState('');
  const [link, setLink] = useState('');
  const [ratio, setRatio] = useState(0.5);
  const ratioRef = useRef(0.5);
  const colsW = useRef(340);
  const startR = useRef(0.5);
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => { startR.current = ratioRef.current; },
    onPanResponderMove: (_e, g) => {
      const r = Math.max(0.22, Math.min(0.78, startR.current + g.dx / Math.max(colsW.current, 1)));
      ratioRef.current = r; setRatio(r);
    },
  })).current;
  useEffect(() => {
    if (!data) return;
    setTitle(data.conv.title); setCreator(''); setLink('');
    setServ(Math.round(data.conv.servings ?? 1) || 1);
    setIngs(data.conv.ingredients.map((x) => ({ id: newId(), name: x.name, g: x.g, orig: x.original })));
    setRight('orig');
  }, [data]);
  const save = () => {
    if (!data) return;
    const r: Recipe = { id: newId(), title: title.trim() || 'Recipe', cat: DRAFT, ingredients: ings, steps: data.conv.recipeGrams, original: data.text, source: 'instagram', creator: creator.trim() || undefined, link: link.trim() || undefined, servings: serv, created: Date.now() };
    saveRecipe(r);
    onSaved(r);
  };
  return (
    <Modal visible={!!data} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={[s.full, { paddingTop: top + 8 }]}>
        <View style={s.fHead}>
          <Pressable onPress={onClose} style={s.back} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back"><Icon d={P.back} size={22} /></Pressable>
          <Text style={s.fTitle}>Check the recipe</Text>
        </View>
        <TextInput style={[s.field, { marginHorizontal: 8 }]} value={title} onChangeText={setTitle} placeholder="Title" placeholderTextColor={c.soft} selectionColor={c.lime} accessibilityLabel="Recipe title" />
        <View style={s.srcRow}>
          <TextInput style={[s.field, s.srcIn]} value={creator} onChangeText={setCreator} placeholder="Creator (@name)" placeholderTextColor={c.soft} selectionColor={c.lime} autoCapitalize="none" accessibilityLabel="Creator" />
          <TextInput style={[s.field, s.srcIn, { flex: 1.3 }]} value={link} onChangeText={setLink} placeholder="Video link" placeholderTextColor={c.soft} selectionColor={c.lime} autoCapitalize="none" autoCorrect={false} keyboardType="url" accessibilityLabel="Video link" />
        </View>
        <View style={{ marginHorizontal: 8, marginTop: 8 }}><Servings value={serv} onChange={setServ} /></View>
        <View style={s.cols} onLayout={(e) => { colsW.current = e.nativeEvent.layout.width; }}>
          <View style={[s.col, card, { flex: ratio }]}>
            <Text style={s.colH}>Ingredients (g)</Text>
            <ScrollView contentContainerStyle={{ paddingBottom: 8 }} showsVerticalScrollIndicator>
              {ings.map((i) => (
                <Pressable key={i.id} onPress={() => setEdit(i)} style={s.ing} accessibilityRole="button" accessibilityLabel={`Edit ${i.name}`}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                    <Text style={[s.ingName, { flex: 1 }]}>{i.name}</Text>
                    <Text style={s.ingG}>{`${i.g} g`}</Text>
                  </View>
                  {i.orig ? <Text style={s.ingO}>{i.orig}</Text> : null}
                </Pressable>
              ))}
              <Pressable onPress={() => setEdit({ id: newId(), name: '', g: 0 })} style={s.addIng} accessibilityRole="button"><Icon d={P.plus} size={16} color={c.limeText} /><Text style={s.link}>Add</Text></Pressable>
            </ScrollView>
          </View>
          <View {...pan.panHandlers} style={s.handle} accessibilityLabel="Resize the columns"><View style={s.handleBar} /></View>
          <View style={[s.col, card, { flex: 1 - ratio }]}>
            <View style={s.tog}>
              {([['orig', 'Original'], ['conv', 'In grams']] as const).map(([k, l]) => (
                <Pressable key={k} onPress={() => setRight(k)} style={[s.togB, right === k && { backgroundColor: c.btn }]} accessibilityRole="button"><Text style={[s.togT, right === k && { color: '#fff' }]}>{l}</Text></Pressable>
              ))}
            </View>
            <ScrollView contentContainerStyle={{ paddingBottom: 8 }} showsVerticalScrollIndicator>
              <Text style={s.body} selectable>{right === 'orig' ? data?.text : data?.conv.recipeGrams || '—'}</Text>
            </ScrollView>
          </View>
        </View>
        <View style={{ paddingHorizontal: 12, paddingBottom: Math.max(bottom, 12) + 8, gap: 6 }}>
          <Text style={s.hint}>Tap an ingredient to fix it. The recipe is saved as a draft: link each ingredient to a food afterwards.</Text>
          <Pressable onPress={save} style={s.cta} accessibilityRole="button"><Text style={s.ctaT}>Save as draft</Text></Pressable>
        </View>
        <IngredientDialog
          ing={edit}
          onClose={() => setEdit(null)}
          onSave={(i) => { setIngs((l) => (l.some((x) => x.id === i.id) ? l.map((x) => (x.id === i.id ? i : x)) : [...l, i])); setEdit(null); }}
          onDelete={() => { setIngs((l) => l.filter((x) => x.id !== edit?.id)); setEdit(null); }}
        />
      </View>
    </Modal>
  );
}

/* ───────────────────────────── recipe detail / editor ───────────────────────────── */

function RecipeDetail({ recipe, onClose, onPickFood }: { recipe: Recipe | null; onClose: () => void; onPickFood: PickFood }) {
  const { state, saveRecipe, removeRecipe } = useStore();
  const { top, bottom } = useSafeAreaInsets();
  const [r, setR] = useState<Recipe | null>(null);
  const [edit, setEdit] = useState<Ingredient | null>(null);
  const [showOrig, setShowOrig] = useState(false);
  const [ask, setAsk] = useState<{ ing: Ingredient; options: Food[] }[]>([]);
  const scroll = useRef<ScrollView>(null);
  const [kb, setKb] = useState(0);
  useEffect(() => {
    const a = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (e) => setKb(e.endCoordinates.height));
    const b = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKb(0));
    return () => { a.remove(); b.remove(); };
  }, []);
  useEffect(() => { setR(recipe); setShowOrig(false); }, [recipe]);
  if (!r) return <Modal visible={false} />;
  const isNew = !state.recipes.some((x) => x.id === r.id);
  const t = totalsOf(r.ingredients, state.foods);
  const patchIng = (i: Ingredient) => setR((x) => x && { ...x, ingredients: x.ingredients.some((y) => y.id === i.id) ? x.ingredients.map((y) => (y.id === i.id ? i : y)) : [...x.ingredients, i] });
  /** Links every unlinked ingredient to the most fitting, most used food of "My foods"; asks (3 choices max) when unsure. */
  const smartLink = () => {
    const m = new Map<string, Food>(Object.entries(state.foods));
    for (const e of state.entries) {
      if (!e.fk || m.has(e.fk) || !e.base || e.base.size !== 100) continue;
      m.set(e.fk, { key: e.fk, name: e.name, brand: e.brand, per: (({ size: _s, unit: _u, ...per }) => per)(e.base), unit: e.base.unit === 'ml' ? 'ml' : 'g', portion: e.portion, src: e.fk.startsWith('off:') ? 'off' : 'ciqual' });
    }
    const use = new Map<string, number>();
    for (const e of state.entries) if (e.fk) use.set(e.fk, (use.get(e.fk) ?? 0) + 1);
    for (const x of state.recipes) for (const i of x.ingredients) if (i.fk) use.set(i.fk, (use.get(i.fk) ?? 0) + 1);
    const foods = [...m.values()];
    const stop = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'un', 'une', 'et', 'au', 'aux', 'en', 'd', 'l', 'a']);
    const words = (x: string) => norm(x).split(/[^a-z0-9]+/).filter((w) => w.length > 1 && !stop.has(w)).map((w) => w.replace(/(s|x)$/, ''));
    const auto: Record<string, string> = {};
    const ask: { ing: Ingredient; options: Food[] }[] = [];
    for (const ing of r.ingredients) {
      if (ing.fk && state.foods[ing.fk]) continue;
      const iw = words(ing.name);
      if (!iw.length) continue;
      const scored = foods.map((fd) => {
        const fw = words(fd.name);
        if (!fw.length) return { fd, s: 0 };
        const hit = iw.filter((w) => fw.includes(w)).length;
        const s = (hit / iw.length) * 0.6 + (hit / fw.length) * 0.4;
        return { fd, s: hit === 0 ? 0 : s };
      }).filter((x) => x.s >= 0.5).sort((a, b) => b.s - a.s || (use.get(b.fd.key) ?? 0) - (use.get(a.fd.key) ?? 0));
      if (!scored.length) continue;
      const [a, b] = scored;
      const ua = use.get(a.fd.key) ?? 0, ub = b ? use.get(b.fd.key) ?? 0 : 0;
      if (!b || a.s - b.s > 0.2 || (ua > 0 && ua >= 2 * ub && a.s >= b.s - 0.05)) auto[ing.id] = a.fd.key;
      else ask.push({ ing, options: scored.slice(0, 3).map((x) => x.fd) });
    }
    const n = Object.keys(auto).length;
    if (n) setR((x) => x && { ...x, ingredients: x.ingredients.map((i) => (auto[i.id] ? { ...i, fk: auto[i.id] } : i)) });
    setAsk(ask);
    if (!n && !ask.length) notify('Smart-Link', 'No matching food found in My foods.');
  };
  const persist = () => { saveRecipe({ ...r, title: r.title.trim() || 'Untitled recipe' }); onClose(); };
  const del = () => {
    askConfirm({ title: 'Delete recipe?', message: 'This recipe will be removed.', confirmText: tr('Delete'), danger: true }).then((ok) => { if (ok) { removeRecipe(r.id); onClose(); } });
  };
  return (
    <Modal visible animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KbView style={[s.full, { paddingTop: top + 8 }]}>
        <View style={s.fHead}>
          <Pressable onPress={onClose} style={s.back} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back"><Icon d={P.back} size={22} /></Pressable>
          <Text style={s.fTitle}>{isNew ? 'New recipe' : 'Recipe'}</Text>
          {!isNew && <Pressable onPress={del} style={s.back} hitSlop={8} accessibilityRole="button" accessibilityLabel="Delete recipe"><Icon d={P.trash} size={20} color={c.red} /></Pressable>}
        </View>
        <ScrollView ref={scroll} contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: kb ? 24 : Math.max(bottom, 12) + 90 }} keyboardShouldPersistTaps="handled">
          <TextInput style={[s.field, s.fieldBig]} value={r.title} onChangeText={(v) => setR({ ...r, title: v })} placeholder="Title" placeholderTextColor={c.soft} selectionColor={c.lime} accessibilityLabel="Recipe title" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipsRow} keyboardShouldPersistTaps="handled" style={{ flexGrow: 0 }}>
            {state.recipeCats.map((cat) => (
              <Pressable key={cat} onPress={() => setR({ ...r, cat })} style={[s.chip, r.cat === cat && { backgroundColor: c.btn }]} accessibilityRole="button" accessibilityState={{ selected: r.cat === cat }}>
                <Text style={[s.chipT, r.cat === cat && { color: '#fff' }]}>{cat}</Text>
              </Pressable>
            ))}
          </ScrollView>
          {r.source === 'instagram' && (
            <View style={[s.srcRow, { marginHorizontal: 0 }]}>
              <TextInput style={[s.field, s.srcIn]} value={r.creator ?? ''} onChangeText={(v) => setR({ ...r, creator: v })} placeholder="Creator (@name)" placeholderTextColor={c.soft} selectionColor={c.lime} autoCapitalize="none" accessibilityLabel="Creator" />
              <TextInput style={[s.field, s.srcIn, { flex: 1.3 }]} value={r.link ?? ''} onChangeText={(v) => setR({ ...r, link: v })} placeholder="Video link" placeholderTextColor={c.soft} selectionColor={c.lime} autoCapitalize="none" autoCorrect={false} keyboardType="url" accessibilityLabel="Video link" />
              {r.link?.trim() ? <Pressable onPress={() => { const u = r.link!.trim(); Linking.openURL(/^https?:/i.test(u) ? u : `https://${u}`).catch(() => {}); }} style={s.openBtn} hitSlop={6} accessibilityRole="button" accessibilityLabel="Open the video"><Icon d={P.next} size={18} color={c.onLime} sw={2.6} /></Pressable> : null}
            </View>
          )}
          {r.cat === DRAFT && r.ingredients.length > 0 && <Text style={s.hint}>Draft: link each ingredient to a food, then move the recipe to a category.</Text>}
          <View style={[s.sumCard, { backgroundColor: c.lime }]}>
            <View style={{ flex: 1 }}>
              <Text style={s.sumBig}>{fmt(t.kcal)}<Text style={s.sumUnit}> kcal</Text></Text>
              {(r.servings ?? 1) > 1 && t.linked > 0 ? <Text style={s.sumLine}>{`${fmt(t.kcal / (r.servings ?? 1))} kcal / serving`}</Text> : null}
              {r.ingredients.length > 0 && t.linked < r.ingredients.length ? <Text style={s.sumLine}>{`${t.linked}/${r.ingredients.length} linked`}</Text> : null}
            </View>
            <View style={s.sumRight}>
              <Text style={s.sumLine}>{`${Math.round(t.p)}g protein`}</Text>
              <Text style={s.sumLine}>{`${Math.round(t.c)}g carbs`}</Text>
              <Text style={s.sumLine}>{`${Math.round(t.f)}g fat`}</Text>
            </View>
          </View>
          <View style={[s.stepsCard, card]}><Servings value={r.servings} onChange={(n) => setR({ ...r, servings: n })} /></View>
          <View style={s.sectRow}>
            <Text style={s.sect}>Ingredients</Text>
            {r.source === 'instagram' && r.ingredients.some((i) => !(i.fk && state.foods[i.fk])) && (
              <Pressable onPress={smartLink} style={s.smart} accessibilityRole="button" accessibilityLabel="Smart-Link">
                <Icon d={P.zap} size={15} color={c.onLime} fill={c.onLime} sw={2} />
                <Text style={s.smartT}>Smart-Link</Text>
              </Pressable>
            )}
          </View>
          <View style={[s.listCard, card]}>
            {r.ingredients.map((i, k) => {
              const fd = i.fk ? state.foods[i.fk] : undefined;
              const n = per100(fd, i.g);
              return (
                <View key={i.id} style={[s.dRow, k > 0 && { borderTopWidth: 1, borderTopColor: c.line }]}>
                  <Pressable onPress={() => setEdit(i)} style={{ flex: 1 }} accessibilityRole="button" accessibilityLabel={`Edit ${i.name}`}>
                    <Text style={s.ingName}>{i.name}</Text>
                    <Text style={s.rSub}>{`${i.g} g${i.orig ? ` · ${i.orig}` : ''}`}</Text>
                  </Pressable>
                  <Pressable onPress={() => onPickFood({ query: i.name, onPick: (fd) => patchIng({ ...i, fk: fd.key }) })} style={[s.linkBtn, fd && { backgroundColor: c.tint }]} accessibilityRole="button" accessibilityLabel={`Link ${i.name}`}>
                    {fd ? <FoodIcon name={fd.name} icon={fd.icon} size={20} /> : <Icon d={P.plus} size={14} color={c.limeText} sw={2.6} />}
                    <Text style={s.linkT} numberOfLines={1}>{fd ? `${fd.name} · ${fmt(n!.kcal)}` : 'Link to food'}</Text>
                  </Pressable>
                </View>
              );
            })}
            <View style={[s.addRow, r.ingredients.length > 0 && { borderTopWidth: 1, borderTopColor: c.line }]}>
              <Pressable onPress={() => onPickFood({ onPick: (fd) => setEdit({ id: newId(), name: fd.name, g: 100, fk: fd.key }) })} style={s.addBig} accessibilityRole="button" accessibilityLabel="Add an ingredient"><Icon d={P.plus} size={16} color={c.onLime} sw={2.6} /><Text style={s.addBigT}>Add an ingredient</Text></Pressable>
            </View>
          </View>
          <Text style={s.sect}>Method</Text>
          <View style={[s.stepsCard, card]}>
            <TextInput style={s.stepsIn} value={r.steps} onChangeText={(v) => { setR({ ...r, steps: v }); setTimeout(() => scroll.current?.scrollToEnd({ animated: false }), 30); }} onFocus={() => setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 250)} multiline scrollEnabled={false} placeholder="Steps…" placeholderTextColor={c.soft} selectionColor={c.lime} textAlignVertical="top" accessibilityLabel="Method" />
          </View>
          {r.original ? (
            <>
              <Pressable onPress={() => setShowOrig((v) => !v)} accessibilityRole="button"><Text style={s.link}>{showOrig ? 'Hide the original text' : 'Show the original text'}</Text></Pressable>
              {showOrig && <Text style={[s.body, s.origBox]} selectable>{r.original}</Text>}
            </>
          ) : null}
        </ScrollView>
        {!kb && <View style={[s.bar, { paddingBottom: Math.max(bottom, 12) + 8 }]}>
          <Pressable onPress={persist} style={s.cta} accessibilityRole="button"><Text style={s.ctaT}>Save</Text></Pressable>
        </View>}
        <Modal visible={ask.length > 0} transparent animationType="fade" onRequestClose={() => setAsk([])} statusBarTranslucent>
          <View style={s.mWrap}>
            {ask[0] && (
              <View style={s.mCard}>
                <Text style={s.mTitle}>{`Which food for “${ask[0].ing.name}”?`}</Text>
                {ask[0].options.map((fd) => (
                  <Pressable key={fd.key} onPress={() => { patchIng({ ...ask[0].ing, fk: fd.key }); setAsk((q) => q.slice(1)); }} style={s.pRow2} accessibilityRole="button" accessibilityLabel={fd.name}>
                    <FoodIcon name={fd.name} icon={fd.icon} size={32} />
                    <Text style={s.pName} numberOfLines={1}>{fd.name}{fd.brand ? ` · ${fd.brand}` : ''}</Text>
                  </Pressable>
                ))}
                <Pressable onPress={() => setAsk((q) => q.slice(1))} style={{ alignSelf: 'center', padding: 10 }} accessibilityRole="button"><Text style={s.link}>Skip</Text></Pressable>
              </View>
            )}
          </View>
        </Modal>
        <IngredientDialog
          ing={edit}
          onClose={() => setEdit(null)}
          onSave={(i) => { patchIng(i); setEdit(null); }}
          onDelete={() => { setR({ ...r, ingredients: r.ingredients.filter((x) => x.id !== edit?.id) }); setEdit(null); }}
        />
      </KbView>
    </Modal>
  );
}

/* ───────────────────────────── categories ───────────────────────────── */

function CatManager({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { state, setRecipeCats } = useStore();
  const [rows, setRows] = useState<{ orig?: string; name: string }[]>([]);
  const [fresh, setFresh] = useState('');
  useEffect(() => { if (visible) { setRows(state.recipeCats.filter((k) => k !== DRAFT).map((k) => ({ orig: k, name: tr(k) }))); setFresh(''); } }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = () => {
    const renamed: Record<string, string> = {};
    const out: string[] = [];
    for (const r of rows) {
      const name = r.orig && r.name === tr(r.orig) ? r.orig : r.name.trim();
      if (!name || out.includes(name) || name === DRAFT) continue;
      out.push(name);
      if (r.orig && r.orig !== name) renamed[r.orig] = name;
    }
    const add = fresh.trim();
    if (add && !out.includes(add) && add !== DRAFT) out.push(add);
    setRecipeCats([...out, DRAFT], renamed);
    onClose();
  };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KbView style={s.mWrap}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <View style={s.mCard}>
          <Text style={s.mTitle}>Recipe categories</Text>
          <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ gap: 8 }} keyboardShouldPersistTaps="handled">
            {rows.map((r, i) => (
              <View key={i} style={s.catEdit}>
                <TextInput style={[s.field, { flex: 1 }]} value={r.name} onChangeText={(v) => setRows((l) => l.map((x, j) => (j === i ? { ...x, name: v } : x)))} selectionColor={c.lime} accessibilityLabel={`Category ${i + 1}`} />
                <Pressable onPress={() => setRows((l) => l.filter((_, j) => j !== i))} style={s.smallBtn} hitSlop={6} accessibilityRole="button" accessibilityLabel="Delete category"><Icon d={P.trash} size={19} color={c.red} /></Pressable>
              </View>
            ))}
            <View style={s.catEdit}>
              <TextInput style={[s.field, { flex: 1 }]} value={fresh} onChangeText={setFresh} placeholder="New category" placeholderTextColor={c.soft} selectionColor={c.lime} accessibilityLabel="New category" />
            </View>
            <Text style={s.hint}>“Draft” is fixed: imported recipes land there. A recipe whose category is deleted moves to “Other”.</Text>
          </ScrollView>
          <Pressable onPress={save} style={s.cta} accessibilityRole="button"><Text style={s.ctaT}>Save</Text></Pressable>
        </View>
      </KbView>
    </Modal>
  );
}

const mkStyles = () => StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingRight: 20 },
  gear: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center' },
  empty: { fontFamily: f.medium, fontSize: 14, color: c.muted, marginHorizontal: 10, marginBottom: 14, lineHeight: 20 },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 10 },
  group: { marginHorizontal: 10, marginBottom: 8, borderRadius: 22, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4 },
  searchIn: { marginHorizontal: 10, marginBottom: 10 },
  catName: { flex: 1, fontFamily: f.extra, fontSize: 17, color: c.ink },
  catCount: { fontFamily: f.bold, fontSize: 14, color: c.muted },
  catEmpty: { fontFamily: f.medium, fontSize: 13, color: c.soft, paddingBottom: 10 },
  recipe: { paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 10 },
  rTitle: { fontFamily: f.regular, fontSize: 16, color: c.ink },
  rSub: { fontFamily: f.medium, fontSize: 12.5, color: c.muted, marginTop: 2 },
  badge: { fontFamily: f.bold, fontSize: 11, color: '#C13584', backgroundColor: '#C1358422', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, overflow: 'hidden' },
  backdrop: { flex: 1, backgroundColor: 'rgba(21,32,15,0.45)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: c.card, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 20, paddingTop: 10 },
  grab: { alignSelf: 'center', width: 42, height: 5, borderRadius: 3, backgroundColor: c.line, marginBottom: 12 },
  sheetT: { fontFamily: f.extra, fontSize: 20, color: c.ink, marginBottom: 10 },
  sRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10 },
  sName: { fontFamily: f.bold, fontSize: 16, color: c.ink },
  sSub: { fontFamily: f.medium, fontSize: 12.5, color: c.muted, marginTop: 1 },
  mWrap: { flex: 1, backgroundColor: 'rgba(21,32,15,0.45)', justifyContent: 'center', padding: 20 },
  mCard: { backgroundColor: c.card, borderRadius: 28, padding: 20, gap: 10 },
  mTitle: { fontFamily: f.extra, fontSize: 20, color: c.ink },
  hint: { fontFamily: f.medium, fontSize: 13, color: c.muted, lineHeight: 18 },
  area: { minHeight: 180, maxHeight: 300, backgroundColor: c.page, borderRadius: 18, padding: 14, fontFamily: f.medium, fontSize: 14.5, color: c.ink },
  err: { fontFamily: f.semi, fontSize: 13.5, color: c.red, lineHeight: 19 },
  cta: { height: 54, borderRadius: 27, backgroundColor: c.btn, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  ctaT: { fontFamily: f.bold, fontSize: 16, color: c.lime },
  link: { fontFamily: f.bold, fontSize: 14, color: c.limeText },
  fieldL: { fontFamily: f.semi, fontSize: 13, color: c.muted },
  field: { backgroundColor: c.page, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 11, fontFamily: f.semi, fontSize: 16, color: c.ink },
  fieldBig: { fontFamily: f.extra, fontSize: 20 },
  smallBtn: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: c.page },
  full: { flex: 1, backgroundColor: c.page },
  fHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingBottom: 10 },
  fTitle: { flex: 1, fontFamily: f.extra, fontSize: 22, color: c.ink },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  cols: { flex: 1, flexDirection: 'row', paddingHorizontal: 6, paddingVertical: 10 },
  col: { borderRadius: 18, padding: 8 },
  handle: { width: 22, alignItems: 'center', justifyContent: 'center' },
  handleBar: { width: 6, height: 44, borderRadius: 3, backgroundColor: c.line },
  colH: { fontFamily: f.extra, fontSize: 14, color: c.ink, marginBottom: 8 },
  ing: { paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: c.line },
  ingName: { fontFamily: f.regular, fontSize: 14.5, color: c.ink },
  ingG: { fontFamily: f.regular, fontSize: 14, color: c.ink },
  ingO: { fontFamily: f.medium, fontSize: 11.5, color: c.muted, marginTop: 1 },
  addIng: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10 },
  tog: { flexDirection: 'row', gap: 4, marginBottom: 8 },
  togB: { flex: 1, height: 30, borderRadius: 15, backgroundColor: c.page, alignItems: 'center', justifyContent: 'center' },
  togT: { fontFamily: f.bold, fontSize: 12, color: c.ink },
  body: { fontFamily: f.regular, fontSize: 13, color: c.ink, lineHeight: 19 },
  origBox: { backgroundColor: c.card, padding: 12, borderRadius: 14 },
  chipsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 16 },
  chip: { paddingHorizontal: 14, height: 36, borderRadius: 18, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center' },
  chipT: { fontFamily: f.bold, fontSize: 13.5, color: c.ink },
  sumCard: { borderRadius: 22, paddingVertical: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  sumRight: { alignItems: 'flex-end', gap: 1 },
  stepsCard: { borderRadius: 20, padding: 14 },
  stepsIn: { padding: 0, minHeight: 120, fontFamily: f.medium, fontSize: 14.5, lineHeight: 21, color: c.ink },
  sumBig: { fontFamily: f.extra, fontSize: 32, lineHeight: 40, color: c.onLime, letterSpacing: -1 },
  sumUnit: { fontFamily: f.bold, fontSize: 15, letterSpacing: 0 },
  sumLine: { fontFamily: f.semi, fontSize: 13, color: c.onLime, opacity: 0.8 },
  srcRow: { flexDirection: 'row', gap: 8, marginHorizontal: 8, marginTop: 8, alignItems: 'center' },
  srcIn: { flex: 1, minWidth: 0, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, fontFamily: f.medium, fontSize: 14, paddingVertical: 9 },
  openBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: c.lime, alignItems: 'center', justifyContent: 'center' },
  sectRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  smart: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.lime, borderRadius: 18, paddingHorizontal: 14, height: 36, elevation: 3, shadowColor: c.lime, shadowOpacity: 0.5, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  smartT: { fontFamily: f.extra, fontSize: 13.5, color: c.onLime, letterSpacing: -0.2 },
  pRow2: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.page, borderRadius: 16, padding: 10 },
  pName: { flex: 1, fontFamily: f.semi, fontSize: 15, color: c.ink },
  sect: { fontFamily: f.extra, fontSize: 17, color: c.ink, marginTop: 4 },
  listCard: { borderRadius: 20, overflow: 'hidden' },
  dRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  linkBtn: { maxWidth: 170, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, height: 36, borderRadius: 18, backgroundColor: c.page },
  linkT: { flexShrink: 1, fontFamily: f.bold, fontSize: 12, color: c.limeText },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 10, backgroundColor: c.page },
  pRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18 },
  linked: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  addBig: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.lime, borderRadius: 20, paddingHorizontal: 14, height: 40 },
  addBigT: { fontFamily: f.bold, fontSize: 13.5, color: c.onLime },
  addSmall: { paddingHorizontal: 10, height: 40, justifyContent: 'center' },
  servRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, paddingVertical: 2 },
  servL: { flex: 1, fontFamily: f.bold, fontSize: 15, color: c.ink },
  servB: { width: 36, height: 36, borderRadius: 18, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center' },
  servIn: { minWidth: 52, textAlign: 'center', fontFamily: f.extra, fontSize: 18, lineHeight: 24, color: c.ink, backgroundColor: c.page, borderRadius: 12, height: 40, paddingHorizontal: 6, paddingVertical: 0, includeFontPadding: false, textAlignVertical: 'center' },
  catEdit: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
let s = mkStyles();
onTheme(() => { s = mkStyles(); });
