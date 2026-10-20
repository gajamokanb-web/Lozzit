import type { Per } from './domain';

export type Food = {
  key: string;
  name: string;
  brand?: string;
  per: Per; // per 100 g (or 100 ml)
  unit: 'g' | 'ml';
  portion?: { label: string; size: number };
  src: 'ciqual' | 'off' | 'custom';
  barcode?: string;
  icon?: string;
};

/* ── Ciqual (ANSES, Table de composition nutritionnelle 2025, Licence Ouverte Etalab 2.0) ─────────
   Bundled in the app, works offline. Row: [code, name, kcal, protein, carbs, fat, usual portion g (INCA3) | 0] */
type Row = [number, string, number, number, number, number, number, number, number, number, number]; // …, portion, sugar, sat fat, fibre, salt
let rows: { r: Row; n: string }[] | null = null;

export const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/œ/g, 'oe');

function load() {
  if (!rows) rows = (require('../assets/ciqual.json') as Row[]).map((r) => ({ r, n: norm(r[1]) }));
  return rows;
}

const toFood = (r: Row): Food => ({
  key: `ciqual:${r[0]}`,
  name: r[1],
  per: { kcal: r[2], p: r[3], c: r[4], f: r[5], sg: r[7], sf: r[8], fi: r[9], sl: r[10] },
  unit: 'g',
  portion: r[6] > 0 ? { label: `1 portion (${r[6]} g)`, size: r[6] } : undefined,
  src: 'ciqual',
});

export function searchCiqual(query: string, limit = 40): Food[] {
  const toks = norm(query).split(/[\s,]+/).filter(Boolean);
  if (!toks.length) return [];
  const scored: [number, Row][] = [];
  for (const { r, n } of load()) {
    if (!toks.every((t) => n.includes(t))) continue;
    const words = n.split(/[\s,()'-]+/);
    let score = n.length; // shorter = more generic = better
    if (n.startsWith(toks[0])) score -= 60;
    if (toks.every((t) => words.some((w) => w.startsWith(t)))) score -= 40;
    scored.push([score, r]);
  }
  return scored.sort((a, b) => a[0] - b[0]).slice(0, limit).map(([, r]) => toFood(r));
}

/* ── Open Food Facts (online) ─────────────────────────────────────────────────────────────────── */
const OFF = 'https://world.openfoodfacts.org';
const HEADERS = { 'User-Agent': 'Lozzit/1.0 (personal calorie tracker, Android)', Accept: 'application/json' };
const FIELDS = 'code,product_name,product_name_fr,brands,nutriments,serving_quantity,quantity';

async function getJson(url: string): Promise<any> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 12000);
  try {
    const res = await fetch(url, { headers: HEADERS, signal: ctl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

function offFood(p: any): Food | null {
  const n = p?.nutriments;
  const name = (p?.product_name_fr || p?.product_name || '').trim();
  const kcal = Number(n?.['energy-kcal_100g'] ?? (n?.['energy_100g'] != null ? n['energy_100g'] / 4.184 : NaN));
  if (!name || !Number.isFinite(kcal)) return null;
  const sq = Number(p.serving_quantity);
  const liquid = /\d\s*(ml|cl|l)\b/i.test(String(p.quantity ?? ''));
  return {
    key: `off:${p.code}`,
    name,
    brand: (p.brands || '').split(',')[0]?.trim() || undefined,
    per: { kcal: Math.round(kcal), p: Number(n['proteins_100g']) || 0, c: Number(n['carbohydrates_100g']) || 0, f: Number(n['fat_100g']) || 0, sg: Number(n['sugars_100g']) || 0, sf: Number(n['saturated-fat_100g']) || 0, fi: Number(n['fiber_100g']) || 0, sl: Number(n['salt_100g']) || 0 },
    unit: liquid ? 'ml' : 'g',
    portion: sq > 0 ? { label: `1 serving (${Math.round(sq)} ${liquid ? 'ml' : 'g'})`, size: sq } : undefined,
    src: 'off',
    barcode: String(p.code),
  };
}

/** null = product not in the database (or without nutrition data). Throws when offline. */
export async function lookupBarcode(code: string): Promise<Food | null> {
  const d = await getJson(`${OFF}/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}`);
  return d.status === 1 ? offFood({ ...d.product, code }) : null;
}

/** Foods of the user's own database matching a query (all words must appear in the name or brand). */
export function searchMine(foods: Food[], query: string, limit = 40): Food[] {
  const toks = norm(query).split(/[\s,]+/).filter(Boolean);
  if (!toks.length) return [];
  return foods.filter((fd) => { const n = norm(`${fd.name} ${fd.brand ?? ''}`); return toks.every((t) => n.includes(t)); }).slice(0, limit);
}

export const sortKey = (name: string) => norm(name);
export const letterOf = (name: string) => { const l = norm(name).trim().charAt(0).toUpperCase(); return l >= 'A' && l <= 'Z' ? l : '#'; };
