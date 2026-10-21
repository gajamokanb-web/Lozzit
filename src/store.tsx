import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Entry, MealKey, Profile } from './domain';
import type { Food } from './foods';
import { DEFAULT_CATS, type Recipe } from './recipes';

type Settings = { fit: boolean; stepSource: string; meals: MealKey[]; showSugar: boolean; showSalt: boolean; showFiber: boolean; showSat: boolean; stepGoal: number; groqKey: string; groqModel: string; iconNames: Record<string, string>; theme: 'light' | 'dark' | 'system'; lang: 'en' | 'fr' }; // stepSource: 'all' or a Health Connect package name
type State = { profile: Profile | null; entries: Entry[]; water: Record<string, number>; weights: Record<string, number>; foods: Record<string, Food>; recipes: Recipe[]; recipeCats: string[]; settings: Settings };
const EMPTY: State = { profile: null, entries: [], water: {}, weights: {}, foods: {}, recipes: [], recipeCats: DEFAULT_CATS, settings: { fit: false, stepSource: 'all', meals: ['breakfast', 'snack_am', 'lunch', 'snack_pm', 'dinner', 'snack_eve'], showSugar: false, showSalt: false, showFiber: false, showSat: false, stepGoal: 10000, groqKey: '', groqModel: 'qwen/qwen3.8-27b', iconNames: {}, theme: 'light', lang: /^fr/i.test(Intl.DateTimeFormat().resolvedOptions().locale) ? 'fr' : 'en' } };
const KEY = 'lozzit:v1';

type Store = {
  ready: boolean;
  state: State;
  setProfile: (p: Profile) => void;
  addEntry: (e: Omit<Entry, 'id'>) => void;
  removeEntry: (id: string) => void;
  updateEntry: (id: string, patch: Partial<Entry>) => void;
  setWater: (day: string, drops: number) => void;
  setWeight: (day: string, kg: number) => void;
  removeWeight: (day: string) => void;
  saveFood: (food: Food) => void;
  setSettings: (s: Partial<Settings>) => void;
  reset: () => void;
  saveRecipe: (r: Recipe) => void;
  removeRecipe: (id: string) => void;
  setRecipeCats: (cats: string[], renamed?: Record<string, string>) => void;
  exportData: () => string;
  importData: (raw: string) => boolean;
};
const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>(EMPTY);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) {
          const saved = JSON.parse(raw);
          // first build used a single 'snack' bucket
          const entries = (saved.entries ?? []).map((e: Omit<Entry, 'meal'> & { meal: string }) => (e.meal === 'snack' ? { ...e, meal: 'snack_pm' } : e));
          setState({ ...EMPTY, ...saved, entries, settings: { ...EMPTY.settings, ...saved.settings } });
        }
      } catch {
        /* unreadable storage: start fresh */
      }
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (ready) AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
  }, [state, ready]);

  const setProfile = useCallback((profile: Profile) => setState((s) => ({ ...s, profile })), []);
  const addEntry = useCallback(
    (e: Omit<Entry, 'id'>) =>
      setState((s) => ({ ...s, entries: [...s.entries, { ...e, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }] })),
    [],
  );
  const removeEntry = useCallback((id: string) => setState((s) => ({ ...s, entries: s.entries.filter((e) => e.id !== id) })), []);
  const updateEntry = useCallback((id: string, patch: Partial<Entry>) => setState((s) => ({ ...s, entries: s.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)) })), []);
  const setWater = useCallback((day: string, drops: number) => setState((s) => ({ ...s, water: { ...s.water, [day]: drops } })), []);
  const setWeight = useCallback(
    (day: string, kg: number) =>
      setState((s) => {
        const weights = { ...s.weights, [day]: kg };
        const latest = Object.keys(weights).sort().pop()!; // the profile weight follows the most recent weigh-in
        return { ...s, weights, profile: s.profile ? { ...s.profile, weightKg: weights[latest] } : s.profile };
      }),
    [],
  );
  const removeWeight = useCallback(
    (day: string) =>
      setState((s) => {
        const weights = { ...s.weights };
        delete weights[day];
        const latest = Object.keys(weights).sort().pop();
        return { ...s, weights, profile: s.profile && latest ? { ...s.profile, weightKg: weights[latest] } : s.profile };
      }),
    [],
  );
  /** Own food database: everything added, scanned or created. */
  const saveFood = useCallback((food: Food) => setState((s) => ({ ...s, foods: { ...s.foods, [food.key]: { ...s.foods[food.key], ...food } } })), []);
  const setSettings = useCallback((p: Partial<Settings>) => setState((s) => ({ ...s, settings: { ...s.settings, ...p } })), []);
  const reset = useCallback(() => setState(EMPTY), []);
  const saveRecipe = useCallback((r: Recipe) => setState((s) => ({ ...s, recipes: s.recipes.some((x) => x.id === r.id) ? s.recipes.map((x) => (x.id === r.id ? r : x)) : [r, ...s.recipes] })), []);
  const removeRecipe = useCallback((id: string) => setState((s) => ({ ...s, recipes: s.recipes.filter((x) => x.id !== id) })), []);
  /** New category list; `renamed` maps old name → new name so recipes follow; recipes of a deleted category go to "Other". */
  const setRecipeCats = useCallback((cats: string[], renamed: Record<string, string> = {}) => setState((s) => ({ ...s, recipeCats: cats, recipes: s.recipes.map((r) => { const n = renamed[r.cat] ?? r.cat; return { ...r, cat: cats.includes(n) ? n : cats.includes('Other') ? 'Other' : cats[0] }; }) })), []);
  /** Everything except the API key. */
  const exportData = useCallback(() => JSON.stringify({ app: 'lozzit', version: 1, exported: new Date().toISOString(), data: { ...state, settings: { ...state.settings, groqKey: '' } } }), [state]);
  const importData = useCallback((raw: string): boolean => {
    try {
      const j = JSON.parse(raw);
      const d = j?.app === 'lozzit' ? j.data : j;
      if (!d || typeof d !== 'object' || !d.profile || !Array.isArray(d.entries)) return false;
      setState((s) => ({ ...EMPTY, ...d, entries: d.entries, settings: { ...EMPTY.settings, ...d.settings, groqKey: s.settings.groqKey }, recipes: Array.isArray(d.recipes) ? d.recipes : [], recipeCats: Array.isArray(d.recipeCats) && d.recipeCats.length ? d.recipeCats : DEFAULT_CATS }));
      return true;
    } catch {
      return false;
    }
  }, []);

  const value = useMemo(
    () => ({ ready, state, setProfile, addEntry, removeEntry, updateEntry, setWater, setWeight, removeWeight, saveFood, setSettings, reset, saveRecipe, removeRecipe, setRecipeCats, exportData, importData }),
    [ready, state, setProfile, addEntry, removeEntry, updateEntry, setWater, setWeight, removeWeight, saveFood, setSettings, reset, saveRecipe, removeRecipe, setRecipeCats, exportData, importData],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStore outside StoreProvider');
  return v;
}
