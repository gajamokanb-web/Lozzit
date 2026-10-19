export type Sex = 'f' | 'm';
export type Profile = {
  name: string;
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  goalKg: number;
  activity: number; // PAL multiplier
};
export type MealKey = 'breakfast' | 'snack_am' | 'lunch' | 'snack_pm' | 'dinner' | 'snack_eve';
export type Entry = { id: string; day: string; meal: MealKey; name: string; kcal: number; p: number; c: number; f: number };

export const MEALS: { key: MealKey; label: string }[] = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'snack_am', label: 'Morning Snacks' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'snack_pm', label: 'Afternoon Snacks' },
  { key: 'dinner', label: 'Dinner' },
  { key: 'snack_eve', label: 'Evening Snacks' },
];

export const ACTIVITY = [
  { v: 1.2, label: 'Mostly sitting', hint: 'Desk job, little exercise' },
  { v: 1.375, label: 'Lightly active', hint: 'Walks, 1–3 workouts a week' },
  { v: 1.55, label: 'Active', hint: '3–5 workouts a week' },
  { v: 1.725, label: 'Very active', hint: 'Hard training most days' },
];

const pad = (n: number) => String(n).padStart(2, '0');
export const dayKey = (d: Date = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseKey = (k: string) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (k: string, n: number) => {
  const d = parseKey(k);
  return dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
};

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** "Mon, Oct 19" */
export const fmtDay = (k: string) => {
  const d = parseKey(k);
  return `${WD[d.getDay()]}, ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
};

/** Monday → Sunday of the week containing `base`. */
export function weekDays(base: Date = new Date()) {
  const monday = new Date(base.getFullYear(), base.getMonth(), base.getDate() - ((base.getDay() + 6) % 7));
  const todayKey = dayKey();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    return { key: dayKey(d), letter: 'MTWTFSS'[i], date: d.getDate(), isToday: dayKey(d) === todayKey };
  });
}

export type Targets = { kcal: number; protein: number; carbs: number; fat: number };

/** Mifflin–St Jeor × activity, ±adjustment from the goal weight, floor at 1200 kcal. */
export function targets(p: Profile): Targets {
  const bmr = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + (p.sex === 'm' ? 5 : -161);
  const delta = p.goalKg - p.weightKg;
  const adj = delta < -0.5 ? -500 : delta > 0.5 ? 300 : 0;
  const kcal = Math.max(1200, Math.round((bmr * p.activity + adj) / 10) * 10);
  const protein = Math.round(1.6 * p.weightKg);
  const fat = Math.round((kcal * 0.25) / 9);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { kcal, protein, carbs, fat };
}

export const sum = (es: Entry[], k: 'kcal' | 'p' | 'c' | 'f') => es.reduce((a, e) => a + e[k], 0);
export const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
