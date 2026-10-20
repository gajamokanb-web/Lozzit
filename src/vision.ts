import type { Per } from './domain';

/** Reads a nutrition label photo with a Groq vision model (default qwen/qwen3.8-27b). */
export type LabelResult = { name?: string; per: Per; servingG?: number; basis: '100' | 'serving'; note?: string };

export const DEFAULT_MODEL = 'qwen/qwen3.8-27b';

const PROMPT = `This is a photo of the nutrition facts table of a food product. Read it and answer with ONE JSON object only, with exactly these keys:
{"product_name": string|null, "basis": "100"|"serving", "serving_size": number|null, "energy_kcal": number|null, "protein_g": number|null, "carbs_g": number|null, "sugar_g": number|null, "fat_g": number|null, "saturated_fat_g": number|null, "fiber_g": number|null, "salt_g": number|null}
- Use the per 100 g (or per 100 ml) column when there is one and set basis to "100".
- If only a per serving column exists, return those numbers, set basis to "serving" and serving_size to the serving weight in g or ml.
- energy_kcal in kcal (if only kJ is shown, divide by 4.184).
- carbs_g is total carbohydrate, sugar_g is "of which sugars", saturated_fat_g is "of which saturates".
- salt_g in grams. If only sodium is shown, salt_g = sodium in g x 2.5.
- Use null for anything that is not on the label. Never guess. Numbers only, no units.`;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function call(base64Jpeg: string, apiKey: string, model: string): Promise<Response> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 120000);
  try {
    return await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      signal: ctl.signal,
      body: JSON.stringify({
        model,
        temperature: 0,
        reasoning_effort: 'none',
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: [{ type: 'text', text: PROMPT }, { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Jpeg}` } }] }],
      }),
    });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    if (ctl.signal.aborted) throw new Error('Groq took too long to answer (over 2 min). Try again.');
    throw new Error(`Network error while contacting Groq (${m}).`);
  } finally {
    clearTimeout(timer);
  }
}

export async function readLabel(base64Jpeg: string, apiKey: string, model: string): Promise<LabelResult> {
  const m = model || DEFAULT_MODEL;
  let res = await call(base64Jpeg, apiKey, m);
  if (!res.ok && (res.status === 503 || res.status === 500 || res.status === 498)) {
    await wait(1500);
    res = await call(base64Jpeg, apiKey, m);
  }
  if (!res.ok) {
    let detail = '';
    try { detail = ((await res.json()) as { error?: { message?: string } })?.error?.message ?? ''; } catch { /* no body */ }
    if (res.status === 401) throw new Error('Groq refused the API key. Check it in Profile.');
    if (res.status === 404) throw new Error('This model name does not exist on Groq. Check the model name in Profile.');
    if (res.status === 413) throw new Error('The photo is too large for Groq. Retake it or pick a smaller image.');
    if (res.status === 429) throw new Error('Groq rate limit reached. Try again in a minute.');
    if (res.status === 400 || res.status === 403) throw new Error(`Groq refused the request${detail ? `: ${detail.slice(0, 160)}` : '. Check your API key and model name in Profile.'}`);
    throw new Error(`Groq returned an error (${res.status}).`);
  }
  const data = await res.json();
  const text: string = data?.choices?.[0]?.message?.content ?? '';
  let j: Record<string, number | string | null>;
  try {
    j = JSON.parse(text.replace(/^```(?:json)?|```$/g, '').trim());
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
