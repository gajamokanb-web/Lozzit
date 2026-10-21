/** Recipes: types, default categories and the Groq (Qwen) call that turns a pasted caption into grams. */
import { DEFAULT_MODEL } from './vision';

export type Ingredient = { id: string; name: string; g: number; orig?: string; fk?: string };
export type Recipe = {
  id: string;
  title: string;
  cat: string; // one of the user's categories
  ingredients: Ingredient[];
  steps: string; // method, quantities in grams when imported
  original?: string; // pasted source text
  creator?: string; // who posted the recipe (Instagram)
  link?: string; // link to the video
  source?: 'instagram';
  servings?: number;
  created: number;
};

export const DRAFT = 'Draft';
export const DEFAULT_CATS = ['Breakfast', 'Main dish', 'Dessert', 'Other', DRAFT];
export const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const PROMPT = `You receive the caption (description) of a social media recipe post. It may be in any language, informal, with emojis and hashtags.
Answer with ONE JSON object only, with exactly these keys:
{"title": string, "servings": number, "ingredients": [{"name": string, "original": string, "grams": number}], "recipe_grams": string}
Rules:
- Write every text field (title, ingredient names, recipe_grams) in French, translating if the post is in another language. Keep "original" exactly as written in the post.
- servings: how many portions the recipe makes: the number stated in the post, otherwise your best estimate from the quantities (whole number, at least 1).
- ingredients: one entry per food. "original" is the quantity exactly as written in the post ("2 cups", "1 c. à soupe", "a pinch", "" if none). "grams" is the amount converted to grams (use ml = g for water-like liquids; for eggs, spoons, cups, pieces, cloves, etc. use typical weights, e.g. 1 egg = 50 g, 1 tbsp oil = 14 g, 1 tsp sugar = 5 g, 1 cup flour = 125 g, 1 cup sugar = 200 g, 1 banana = 120 g). Round to whole grams. Seasonings with no amount: 2 g.
- recipe_grams: the whole recipe rewritten as clean text: first the ingredient list, one per line "- 120 g flour", then the steps numbered, with every quantity in grams.
- Ignore hashtags, mentions, promo text and calls to action.
- Never invent ingredients that are not in the post.`;

export type Converted = { title: string; servings?: number; ingredients: { name: string; original: string; g: number }[]; recipeGrams: string };

export async function convertRecipe(text: string, apiKey: string, model: string): Promise<Converted> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 120000);
  let res: Response;
  try {
    res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      signal: ctl.signal,
      body: JSON.stringify({
        model: model || DEFAULT_MODEL,
        temperature: 0,
        reasoning_effort: 'low',
        reasoning_format: 'hidden',
        response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: PROMPT }, { role: 'user', content: text.slice(0, 12000) }],
      }),
    });
  } catch (e) {
    if (ctl.signal.aborted) throw new Error('Groq took too long to answer (over 2 min). Try again.');
    throw new Error(`Network error while contacting Groq (${e instanceof Error ? e.message : String(e)}).`);
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    let detail = '';
    try { detail = ((await res.json()) as { error?: { message?: string } })?.error?.message ?? ''; } catch { /* no body */ }
    if (res.status === 401) throw new Error('Groq refused the API key. Check it in Profile.');
    if (res.status === 404) throw new Error('This model name does not exist on Groq. Check the model name in Profile.');
    if (res.status === 429) throw new Error('Groq rate limit reached. Try again in a minute.');
    throw new Error(`Groq returned an error (${res.status})${detail ? `: ${detail.slice(0, 140)}` : '.'}`);
  }
  const data = await res.json();
  const raw: string = (data?.choices?.[0]?.message?.content ?? '').replace(/<think>[\s\S]*?<\/think>/g, '');
  let j: { title?: unknown; servings?: unknown; ingredients?: unknown; recipe_grams?: unknown };
  try {
    j = JSON.parse(raw.replace(/^[\s\S]*?(\{)/, '{').replace(/\}[^}]*$/, '}'));
  } catch {
    throw new Error('The recipe could not be read. Paste the full description and try again.');
  }
  const list = Array.isArray(j.ingredients) ? j.ingredients : [];
  const ingredients = list
    .map((x: { name?: unknown; original?: unknown; grams?: unknown }) => ({
      name: typeof x?.name === 'string' ? x.name.trim() : '',
      original: typeof x?.original === 'string' ? x.original.trim() : '',
      g: typeof x?.grams === 'number' && Number.isFinite(x.grams) ? Math.max(0, Math.round(x.grams)) : 0,
    }))
    .filter((x) => x.name);
  if (!ingredients.length) throw new Error('No ingredients found in this text. Paste the full recipe description.');
  return {
    title: typeof j.title === 'string' && j.title.trim() ? j.title.trim() : 'Recipe',
    servings: typeof j.servings === 'number' && j.servings > 0 ? j.servings : undefined,
    ingredients,
    recipeGrams: typeof j.recipe_grams === 'string' ? j.recipe_grams.trim() : '',
  };
}
