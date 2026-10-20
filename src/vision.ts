import type { Per } from './domain';

/** Reads a nutrition label photo with the Gemini API (Google AI Studio key, free Flash model). */
export type LabelResult = { name?: string; per: Per; servingG?: number; basis: '100' | 'serving'; note?: string };

export const DEFAULT_MODEL = 'gemini-flash-latest';

const num = { type: 'NUMBER', nullable: true };
const SCHEMA = {
  type: 'OBJECT',
  properties: {
    product_name: { type: 'STRING', nullable: true },
    basis: { type: 'STRING', enum: ['100', 'serving'] },
    serving_size: num,
    energy_kcal: num,
    protein_g: num,
    carbs_g: num,
    sugar_g: num,
    fat_g: num,
    saturated_fat_g: num,
    fiber_g: num,
    salt_g: num,
  },
  required: ['basis'],
};

const PROMPT = `This is a photo of the nutrition facts table of a food product. Read it and return JSON.
- Use the per 100 g (or per 100 ml) column when there is one and set basis to "100".
- If only a per serving column exists, return those numbers, set basis to "serving" and serving_size to the serving weight in g or ml.
- energy_kcal in kcal (if only kJ is shown, divide by 4.184).
- carbs_g is total carbohydrate, sugar_g is "of which sugars", saturated_fat_g is "of which saturates".
- salt_g in grams. If only sodium is shown, salt_g = sodium in g × 2.5.
- Use null for anything that is not on the label. Never guess. Numbers only, no units.`;

export async function readLabel(base64Jpeg: string, apiKey: string, model: string): Promise<LabelResult> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 45000);
  let res: Response;
  try {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model || DEFAULT_MODEL)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      signal: ctl.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: 'image/jpeg', data: base64Jpeg } }] }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0 },
      }),
    });
  } catch {
    throw new Error('Could not reach Google. Check your connection and try again.');
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    if (res.status === 400 || res.status === 403) throw new Error('Google refused the request. Check your API key and model name in Profile.');
    if (res.status === 404) throw new Error('This model name does not exist. Check the model name in Profile.');
    if (res.status === 429) throw new Error('Free quota reached for now. Try again in a minute.');
    throw new Error(`Google returned an error (${res.status}).`);
  }
  const data = await res.json();
  const text: string = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
  let j: Record<string, number | string | null>;
  try {
    j = JSON.parse(text.replace(/^```json|```$/g, '').trim());
  } catch {
    throw new Error('The label could not be read. Try a sharper, well lit photo of the table.');
  }
  const n = (k: string) => (typeof j[k] === 'number' && Number.isFinite(j[k] as number) ? (j[k] as number) : undefined);
  const basis = j.basis === 'serving' ? 'serving' : '100';
  const serving = n('serving_size');
  const k = basis === 'serving' && serving && serving > 0 ? 100 / serving : 1;
  const r = (v?: number, d = 1) => (v == null ? undefined : Math.round(v * k * 10 ** d) / 10 ** d);
  const per: Per = { kcal: Math.round((n('energy_kcal') ?? 0) * k), p: r(n('protein_g')) ?? 0, c: r(n('carbs_g')) ?? 0, f: r(n('fat_g')) ?? 0 };
  const sg = r(n('sugar_g')), sf = r(n('saturated_fat_g')), fi = r(n('fiber_g')), sl = r(n('salt_g'), 2);
  if (sg != null) per.sg = sg;
  if (sf != null) per.sf = sf;
  if (fi != null) per.fi = fi;
  if (sl != null) per.sl = sl;
  if (!per.kcal && !per.p && !per.c && !per.f) throw new Error('No nutrition values found in the photo. Frame the whole table and try again.');
  return {
    name: typeof j.product_name === 'string' && j.product_name.trim() ? j.product_name.trim() : undefined,
    per,
    servingG: basis === 'serving' ? serving ?? undefined : undefined,
    basis,
    note: basis === 'serving' && !(serving && serving > 0) ? 'Only per-serving values were found without a serving size: check them.' : undefined,
  };
}
