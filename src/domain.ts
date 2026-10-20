import { getLang } from './i18n';
import { frFormula } from './fr';
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
  macros?: { p: number; c: number; f: number }; // legacy: fixed grams
  method?: MethodKey; // how the budget is computed (default Mifflin–St Jeor)
  rules?: { p: MacroRule; c: MacroRule; f: MacroRule }; // how each macro target is set
};
export type MethodKey = 'mifflin' | 'harris' | 'schofield' | 'owen';
/** auto: fills what the other macros leave; gkg: grams per kg of body weight; pct: % of daily calories; g: fixed grams. */
export type MacroRule = { t: 'auto' | 'gkg' | 'pct' | 'g'; v: number };
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
    return { key: dayKey(d), letter: (getLang() === 'fr' ? 'LMMJVSD' : 'MTWTFSS')[i], date: d.getDate(), isToday: dayKey(d) === todayKey };
  });
}

export type Targets = { kcal: number; protein: number; carbs: number; fat: number; sugar: number; salt: number; fiber: number; sat: number };

const fx = (n: number, d = 1) => String(Math.round(n * 10 ** d) / 10 ** d);
const ageBand = (a: number) => (a < 30 ? 0 : a < 60 ? 1 : 2);
const MJ = 239.006; // kcal per MJ

/** Ways to estimate resting energy (BMR). Each returns the value and the formula with the person's numbers filled in. */
export const METHODS: { key: MethodKey; name: string; source: string; calc: (p: Profile) => { bmr: number; text: string } }[] = [
  {
    key: 'mifflin', name: 'Mifflin–St Jeor', source: '1990, the most accurate of the common formulas for most adults',
    calc: (p) => {
      const m = p.sex === 'm';
      const bmr = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + (m ? 5 : -161);
      return { bmr, text: `10 × ${p.weightKg} kg + 6.25 × ${p.heightCm} cm − 5 × ${p.age} y ${m ? '+ 5' : '− 161'} = ${fx(bmr, 0)} kcal` };
    },
  },
  {
    key: 'harris', name: 'Harris–Benedict (revised)', source: 'Roza & Shizgal, 1984; classic formula, tends to read a bit higher',
    calc: (p) => {
      const m = p.sex === 'm';
      const bmr = m ? 88.362 + 13.397 * p.weightKg + 4.799 * p.heightCm - 5.677 * p.age : 447.593 + 9.247 * p.weightKg + 3.098 * p.heightCm - 4.33 * p.age;
      return { bmr, text: m ? `88.362 + 13.397 × ${p.weightKg} + 4.799 × ${p.heightCm} − 5.677 × ${p.age} = ${fx(bmr, 0)} kcal` : `447.593 + 9.247 × ${p.weightKg} + 3.098 × ${p.heightCm} − 4.330 × ${p.age} = ${fx(bmr, 0)} kcal` };
    },
  },
  {
    key: 'schofield', name: 'Schofield (FAO/WHO)', source: '1985, used by WHO; uses weight and age band only',
    calc: (p) => {
      const m = p.sex === 'm';
      const b = ageBand(p.age);
      const [a, c0] = (m ? [[0.063, 2.896], [0.048, 3.653], [0.049, 2.459]] : [[0.062, 2.036], [0.034, 3.538], [0.038, 2.755]])[b];
      const mj = a * p.weightKg + c0;
      const bmr = mj * MJ;
      return { bmr, text: `(${a} × ${p.weightKg} kg + ${c0}) MJ = ${fx(mj, 2)} MJ × 239 = ${fx(bmr, 0)} kcal (${['under 30', '30–59', '60+'][b]} years)` };
    },
  },
  {
    key: 'owen', name: 'Owen', source: '1986–87; weight only, simple',
    calc: (p) => {
      const m = p.sex === 'm';
      const bmr = m ? 879 + 10.2 * p.weightKg : 795 + 7.18 * p.weightKg;
      return { bmr, text: `${m ? '879 + 10.2' : '795 + 7.18'} × ${p.weightKg} kg = ${fx(bmr, 0)} kcal` };
    },
  },
];
export const methodOf = (p: Profile) => METHODS.find((m) => m.key === (p.method ?? 'mifflin')) ?? METHODS[0];

/** Goal adjustment: −500 kcal to lose, +300 to gain, none within ±0.5 kg of the goal. */
export function goalAdjust(p: Profile) {
  const delta = p.goalKg - p.weightKg;
  return delta < -0.5 ? { adj: -500, why: `goal ${p.goalKg} kg is below your weight → −500 kcal to lose about 0.5 kg a week` } : delta > 0.5 ? { adj: 300, why: `goal ${p.goalKg} kg is above your weight → +300 kcal to gain slowly` } : { adj: 0, why: 'you are at your goal weight → no adjustment' };
}
/** Step by step budget for a method (floor 1200 kcal, rounded to 10). */
export function budgetFor(p: Profile, key: MethodKey = p.method ?? 'mifflin') {
  const m = METHODS.find((x) => x.key === key)!;
  const { bmr, text } = m.calc(p);
  const tdee = bmr * p.activity;
  const { adj, why } = goalAdjust(p);
  const raw = tdee + adj;
  const kcal = Math.max(1200, Math.round(raw / 10) * 10);
  return { method: m, bmr, text: getLang() === 'fr' ? frFormula(text) : text, tdee, adj, why, raw, kcal, floored: raw < 1200 };
}
export const autoBudget = (p: Profile) => budgetFor(p, p.method ?? 'mifflin').kcal;
export function autoMacros(p: Profile, kcal: number) {
  const protein = Math.round(1.6 * p.weightKg);
  const fat = Math.round((kcal * 0.25) / 9);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { p: protein, c: carbs, f: fat };
}
const KCAL_PER_G = { p: 4, c: 4, f: 9 } as const;
/** Grams for each macro: fixed rules first, then the "auto" ones share the calories that are left. */
export function resolveMacros(p: Profile, kcal: number, rules: NonNullable<Profile['rules']>) {
  const d = autoMacros(p, kcal);
  const out = { ...d };
  let used = 0;
  const autos: ('p' | 'c' | 'f')[] = [];
  for (const k of ['p', 'c', 'f'] as const) {
    const r = rules[k];
    if (r.t === 'auto') { autos.push(k); continue; }
    out[k] = Math.round(r.t === 'g' ? r.v : r.t === 'gkg' ? r.v * p.weightKg : (r.v / 100) * kcal / KCAL_PER_G[k]);
    used += out[k] * KCAL_PER_G[k];
  }
  if (autos.length) {
    const left = Math.max(0, kcal - used);
    const w = autos.reduce((a, k) => a + d[k] * KCAL_PER_G[k], 0) || 1;
    for (const k of autos) out[k] = Math.round((left * ((d[k] * KCAL_PER_G[k]) / w)) / KCAL_PER_G[k]);
  }
  return out;
}

export function targets(p: Profile): Targets {
  const kcal = p.budget ?? autoBudget(p);
  const m = p.rules ? resolveMacros(p, kcal, p.rules) : p.macros ?? autoMacros(p, kcal);
  return {
    kcal, protein: m.p, carbs: m.c, fat: m.f,
    sugar: Math.round((kcal * 0.1) / 4), // WHO: free sugars under 10 % of energy
    salt: 5, // WHO: under 5 g a day
    fiber: Math.round((kcal / 1000) * 14), // 14 g per 1000 kcal
    sat: Math.round((kcal * 0.1) / 9), // under 10 % of energy
  };
}

export const sum = (es: Entry[], k: 'kcal' | 'p' | 'c' | 'f' | 'sg' | 'sl' | 'fi' | 'sf') => es.reduce((a, e) => a + (e[k] ?? 0), 0);
export const fmt = (n: number) => { const t = Math.round(n).toLocaleString('en-US'); return getLang() === 'fr' ? t.replace(/,/g, '\u202f') : t; };
