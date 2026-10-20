import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Entry, Profile } from './domain';
import type { Food } from './foods';

type Settings = { fit: boolean; stepSource: string }; // stepSource: 'all' or a Health Connect package name
type State = { profile: Profile | null; entries: Entry[]; water: Record<string, number>; weights: Record<string, number>; foods: Record<string, Food>; settings: Settings };
const EMPTY: State = { profile: null, entries: [], water: {}, weights: {}, foods: {}, settings: { fit: false, stepSource: 'all' } };
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
  saveFood: (food: Food) => void;
  setSettings: (s: Partial<Settings>) => void;
  reset: () => void;
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
  /** Own food database: everything added, scanned or created. */
  const saveFood = useCallback((food: Food) => setState((s) => ({ ...s, foods: { ...s.foods, [food.key]: { ...s.foods[food.key], ...food } } })), []);
  const setSettings = useCallback((p: Partial<Settings>) => setState((s) => ({ ...s, settings: { ...s.settings, ...p } })), []);
  const reset = useCallback(() => setState(EMPTY), []);

  const value = useMemo(
    () => ({ ready, state, setProfile, addEntry, removeEntry, updateEntry, setWater, setWeight, saveFood, setSettings, reset }),
    [ready, state, setProfile, addEntry, removeEntry, updateEntry, setWater, setWeight, saveFood, setSettings, reset],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStore outside StoreProvider');
  return v;
}
