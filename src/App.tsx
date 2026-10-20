import React, { useState } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { c } from './theme';
import { dayKey, type MealKey } from './domain';
import { StoreProvider, useStore } from './store';
import { BottomNav, type Tab } from './ui';
import { Onboarding } from './screens/Onboarding';
import { Home } from './screens/Home';
import { AddFood, type AddTarget } from './screens/AddFood';
import { AddSheet } from './screens/AddSheet';
import { Logs, Profile, Stats } from './screens/Others';
import { Calendar } from './screens/Calendar';

function hourMeal(): MealKey {
  const h = new Date().getHours();
  return h < 9 ? 'breakfast' : h < 11 ? 'snack_am' : h < 14 ? 'lunch' : h < 17 ? 'snack_pm' : h < 21 ? 'dinner' : 'snack_eve';
}

function Root() {
  const { ready, state, setProfile } = useStore();
  const [tab, setTab] = useState<Tab>('home');
  const [selected, setSelected] = useState(dayKey());
  const [calendar, setCalendar] = useState(false);
  const [adding, setAdding] = useState<AddTarget | null>(null);
  const [sheet, setSheet] = useState(false);

  if (!ready) return <View style={{ flex: 1, backgroundColor: c.page }} />;
  if (!state.profile) return <Onboarding onDone={(p) => { setTab('home'); setProfile(p); }} />;

  return (
    <View style={{ flex: 1, backgroundColor: c.page }}>
      {tab === 'home' && (
        <Home selected={selected} onSelect={setSelected} onOpenCalendar={() => setCalendar(true)} onAdd={(meal, day) => setAdding({ meal, day })} onEdit={(e) => setAdding({ meal: e.meal, day: e.day, editId: e.id })} onGoSettings={() => setTab('profile')} />
      )}
      {tab === 'stats' && <Stats />}
      {tab === 'meals' && <Logs onPickDay={(k) => { setSelected(k); setTab('home'); }} />}
      {tab === 'profile' && <Profile />}
      <BottomNav tab={tab} onTab={setTab} onAdd={() => setSheet(true)} />
      <AddSheet visible={sheet} day={selected} suggested={hourMeal()} onClose={() => setSheet(false)} onMeal={(m) => { setSheet(false); setAdding({ meal: m, day: selected }); }} />
      <Calendar visible={calendar} selected={selected} marks={new Set(state.entries.map((e) => e.day))} onPick={setSelected} onClose={() => setCalendar(false)} />
      <AddFood target={adding} onClose={() => setAdding(null)} />
    </View>
  );
}

export default function App() {
  const [loaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  if (!loaded) return null;
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <StoreProvider>
        <Root />
      </StoreProvider>
    </SafeAreaProvider>
  );
}
