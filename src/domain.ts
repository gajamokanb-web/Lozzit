export type Sex = 'f' | 'm';
export type Profile = {
  name: string;
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  goalKg: number;
  activity: number; // PAL multiplier
  budget?: number; // daily kcal override (otherwise computed)
  macros?: { p: number; c: number; f: number }; // daily macro targets in grams (otherwise computed)
};
export type MealKey = 'breakfast' | 'snack_am' | 'lunch' | 'snack_pm' | 'dinner' | 'snack_eve';
/** Optional extras, grams: sugar, salt, fibre, saturated fat. */
export type Extra = { sg?: number; sl?: number; fi?: number; sf?: number };
export const EXTRAS: { k: keyof Extra; label: string; unit: string }[] = [
  { k: 'sg', label: 'Sugar', unit: 'g' },
  { k: 'sl', label: 'Salt', unit: 'g' },
  { k: 'fi', label: 'Fiber', unit: 'g' },
  { k: 'sf', label: 'Saturated fat', unit: 'g' },
];
export type Per = { kcal: number; p: number; c: number; f: number } & Extra;
/** Nutrition for `size` units. Foods: per 100 g/ml. Quick-add items: the whole serving (size 1, 'srv'). */
export type Base = Per & { size: number; unit: 'g' | 'ml' | 'srv' };
export type Entry = {
  id: string; day: string; meal: MealKey; name: string; brand?: string;
  kcal: number; p: number; c: number; f: number; // totals for `qty`
  sg?: number; sl?: number; fi?: number; sf?: number;
  base?: Base; qty?: number; fk?: string; portion?: { label: string; size: number };
};

const r1 = (n: number) => Math.round(n * 10) / 10;
/** Totals for `qty` units of a base. */
const r2 = (n: number) => Math.round(n * 100) / 100;
export const scale = (b: Base, qty: number): Per => {
  const k = qty / b.size;
  const out: Per = { kcal: Math.round(b.kcal * k), p: r1(b.p * k), c: r1(b.c * k), f: r1(b.f * k) };
  for (const { k: x } of EXTRAS) if (b[x] != null) out[x] = r2((b[x] as number) * k);
  return out;
};
/** The same entry with its quantity multiplied by `factor` (legacy entries scale their totals). */
export const scaleEntry = (e: Entry, factor: number): Partial<Entry> => {
  if (e.base) {
    const qty = r2((e.qty ?? e.base.size) * factor);
    return { qty, ...scale(e.base, qty) };
  }
  const out: Partial<Entry> = { kcal: Math.round(e.kcal * factor), p: r1(e.p * factor), c: r1(e.c * factor), f: r1(e.f * factor) };
  for (const { k } of EXTRAS) if (e[k] != null) out[k] = r2((e[k] as number) * factor);
  return out;
};
/** Base + quantity of any entry, including ones saved before quantities existed. */
export const entryBase = (e: Entry): { base: Base; qty: number } =>
  e.base ? { base: e.base, qty: e.qty ?? e.base.size } : { base: { kcal: e.kcal, p: e.p, c: e.c, f: e.f, size: 1, unit: 'srv' }, qty: 1 };

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

export type Targets = { kcal: number; protein: number; carbs: number; fat: number; sugar: number; salt: number; fiber: number; sat: number };

/** Mifflin–St Jeor × activity, ±adjustment from the goal weight, floor at 1200 kcal. Overrides from the profile win. */
export function autoBudget(p: Profile) {
  const bmr = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + (p.sex === 'm' ? 5 : -161);
  const delta = p.goalKg - p.weightKg;
  const adj = delta < -0.5 ? -500 : delta > 0.5 ? 300 : 0;
  return Math.max(1200, Math.round((bmr * p.activity + adj) / 10) * 10);
}
export function autoMacros(p: Profile, kcal: number) {
  const protein = Math.round(1.6 * p.weightKg);
  const fat = Math.round((kcal * 0.25) / 9);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { p: protein, c: carbs, f: fat };
}
export function targets(p: Profile): Targets {
  const kcal = p.budget ?? autoBudget(p);
  const m = p.macros ?? autoMacros(p, kcal);
  return {
    kcal, protein: m.p, carbs: m.c, fat: m.f,
    sugar: Math.round((kcal * 0.1) / 4), // WHO: free sugars under 10 % of energy
    salt: 5, // WHO: under 5 g a day
    fiber: Math.round((kcal / 1000) * 14), // 14 g per 1000 kcal
    sat: Math.round((kcal * 0.1) / 9), // under 10 % of energy
  };
}

export const sum = (es: Entry[], k: 'kcal' | 'p' | 'c' | 'f' | 'sg' | 'sl' | 'fi' | 'sf') => es.reduce((a, e) => a + (e[k] ?? 0), 0);
export const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
