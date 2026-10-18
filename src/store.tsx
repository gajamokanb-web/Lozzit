import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Entry, Profile } from './domain';

type State = { profile: Profile | null; entries: Entry[]; water: Record<string, number> };
const EMPTY: State = { profile: null, entries: [], water: {} };
const KEY = 'lozzit:v1';

type Store = {
  ready: boolean;
  state: State;
  setProfile: (p: Profile) => void;
  addEntry: (e: Omit<Entry, 'id'>) => void;
  removeEntry: (id: string) => void;
  setWater: (day: string, drops: number) => void;
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
        if (raw) setState({ ...EMPTY, ...JSON.parse(raw) });
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
  const setWater = useCallback((day: string, drops: number) => setState((s) => ({ ...s, water: { ...s.water, [day]: drops } })), []);
  const reset = useCallback(() => setState(EMPTY), []);

  const value = useMemo(
    () => ({ ready, state, setProfile, addEntry, removeEntry, setWater, reset }),
    [ready, state, setProfile, addEntry, removeEntry, setWater, reset],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStore outside StoreProvider');
  return v;
}
