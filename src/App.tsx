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
import { AddFood } from './screens/AddFood';
import { MealsLog, Profile, Stats } from './screens/Others';

function hourMeal(): MealKey {
  const h = new Date().getHours();
  return h < 11 ? 'breakfast' : h < 15 ? 'lunch' : h < 18 ? 'snack' : 'dinner';
}

function Root() {
  const { ready, state, setProfile } = useStore();
  const [tab, setTab] = useState<Tab>('home');
  const [adding, setAdding] = useState<{ meal: MealKey; day: string } | null>(null);

  if (!ready) return <View style={{ flex: 1, backgroundColor: c.page }} />;
  if (!state.profile) return <Onboarding onDone={(p) => { setTab('home'); setProfile(p); }} />;

  return (
    <View style={{ flex: 1, backgroundColor: c.page }}>
      {tab === 'home' && <Home onAdd={(meal, day) => setAdding({ meal, day })} onProfile={() => setTab('profile')} />}
      {tab === 'stats' && <Stats />}
      {tab === 'meals' && <MealsLog />}
      {tab === 'profile' && <Profile />}
      <BottomNav tab={tab} onTab={setTab} onScan={() => setAdding({ meal: hourMeal(), day: dayKey() })} />
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
