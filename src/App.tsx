import { ConfirmHost } from './dialog';
import React, { useState } from 'react';
import { useColorScheme, View } from 'react-native';
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
import { applyTheme, c } from './theme';
import { setLang } from './i18n';
import { dayKey, type MealKey } from './domain';
import { StoreProvider, useStore } from './store';
import { BottomNav, type Tab } from './ui';
import { Onboarding } from './screens/Onboarding';
import { Home } from './screens/Home';
import { AddFood, type AddTarget } from './screens/AddFood';
import { AddSheet, type SheetView } from './screens/AddSheet';
import { Profile } from './screens/Others';
import { Recipes, RecipeSheet, type RecipeRequest, type PickFood } from './screens/Recipes';
import { Stats } from './screens/Stats';
import { Calendar } from './screens/Calendar';

function hourMeal(enabled: MealKey[]): MealKey {
  const h = new Date().getHours();
  const want: MealKey = h < 9 ? 'breakfast' : h < 11 ? 'snack_am' : h < 14 ? 'lunch' : h < 17 ? 'snack_pm' : h < 21 ? 'dinner' : 'snack_eve';
  return enabled.includes(want) ? want : enabled[0] ?? want;
}

function Root() {
  const { ready, state, setProfile, setWeight } = useStore();
  const scheme = useColorScheme();
  const [tab, setTab] = useState<Tab>('home');
  const [selected, setSelected] = useState(dayKey());
  const [calendar, setCalendar] = useState(false);
  const [adding, setAdding] = useState<AddTarget | null>(null);
  const [sheet, setSheet] = useState<SheetView | null>(null);
  const [sheetOn, setSheetOn] = useState(false);
  const [recipeSheet, setRecipeSheet] = useState(false);
  const [recipeReq, setRecipeReq] = useState<RecipeRequest>(null);
  const [pickTarget, setPickTarget] = useState<AddTarget | null>(null);
  const pickFood: PickFood = (o) => setPickTarget({ meal: 'breakfast', day: selected, pick: o.onPick, query: o.query, scan: o.scan, create: o.create });
  const openSheet = (v: SheetView) => { setSheet(v); setSheetOn(true); };

  const mode = state.settings.theme === 'system' ? (scheme === 'dark' ? 'dark' : 'light') : state.settings.theme;
  // swap the live palette / language before children render; the key remounts them with fresh styles
  applyTheme(mode);
  setLang(state.settings.lang);
  const skin = `${mode}-${state.settings.lang}`;

  if (!ready) return <View style={{ flex: 1, backgroundColor: c.page }} />;
  if (!state.profile) return <Onboarding key={skin} onDone={(p) => { setTab('home'); setProfile(p); setWeight(dayKey(), p.weightKg); }} />;

  return (
    <View key={skin} style={{ flex: 1, backgroundColor: c.page }}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      {tab === 'home' && (
        <Home selected={selected} onSelect={setSelected} onOpenCalendar={() => setCalendar(true)} onAdd={(meal, day, scan) => setAdding({ meal, day, scan })} onEdit={(e) => setAdding({ meal: e.meal, day: e.day, editId: e.id })} onGoSettings={() => setTab('profile')} />
      )}
      {tab === 'stats' && <Stats onLogWeight={() => openSheet('weight')} />}
      {tab === 'recipes' && <Recipes request={recipeReq} onConsumed={() => setRecipeReq(null)} onPickFood={pickFood} />}
      {tab === 'profile' && <Profile />}
      <BottomNav tab={tab} onTab={setTab} onAdd={() => (tab === 'recipes' ? setRecipeSheet(true) : openSheet('grid'))} />
      <RecipeSheet visible={recipeSheet} onClose={() => setRecipeSheet(false)} onNew={(cat) => setRecipeReq({ n: Date.now(), kind: 'new', cat })} onImport={() => setRecipeReq({ n: Date.now(), kind: 'import' })} />
      <AddSheet visible={sheetOn} start={sheet ?? 'grid'} day={selected} suggested={hourMeal(state.settings.meals)} onClose={() => setSheetOn(false)} onMeal={(m) => { setSheetOn(false); setAdding({ meal: m, day: selected }); }} />
      <Calendar visible={calendar} selected={selected} marks={new Set(state.entries.map((e) => e.day))} onPick={setSelected} onClose={() => setCalendar(false)} />
      <AddFood target={adding} onClose={() => setAdding(null)} />
      <AddFood target={pickTarget} onClose={() => setPickTarget(null)} />
      <ConfirmHost />
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
      <StoreProvider>
        <Root />
      </StoreProvider>
    </SafeAreaProvider>
  );
}
