import type {
  AppData, GroceryItem, Ingredient, InventoryItem, Nutrients, Recipe, RecipeIngredient, Unit, PriceSource, PreparedMeal,
} from '../types';
import { convert, gramsPerUnit, kind, toGrams } from './units';
import { ZERO, addN, scaleN } from './nutrition';
import { daysUntil, uid } from './dates';

export type IngMap = Map<string, Ingredient>;
export const ingMap = (d: Pick<AppData, 'ingredients'>): IngMap => new Map(d.ingredients.map((i) => [i.id, i]));

// ───────────────────────── Stock ─────────────────────────

export interface Stock {
  /** Known total in the requested unit (excludes unknown/unconvertible entries). */
  known: number;
  /** At least one in-stock entry has unknown quantity or can't be converted. */
  unknown: boolean;
  /** Any entry that isn't out of stock / zero. */
  present: boolean;
  items: InventoryItem[];
  earliestExpiry?: string;
}

export function isInStock(it: InventoryItem): boolean {
  if (it.outOfStock) return false;
  if (it.quantity === null) return true;
  return it.quantity > 0;
}

export function stockFor(d: Pick<AppData, 'inventory'>, im: IngMap, ingredientId: string, unit: Unit): Stock {
  const ing = im.get(ingredientId);
  const items = d.inventory.filter((i) => i.ingredientId === ingredientId && isInStock(i));
  let known = 0;
  let unknown = false;
  let earliest: string | undefined;
  for (const it of items) {
    if (it.expirationDate && (!earliest || it.expirationDate < earliest)) earliest = it.expirationDate;
    if (it.quantity === null) { unknown = true; continue; }
    const c = convert(it.quantity, it.unit, unit, ing);
    if (c == null) { unknown = true; continue; }
    known += c;
  }
  return { known, unknown, present: items.length > 0, items, earliestExpiry: earliest };
}

export function isLowStock(it: InventoryItem): boolean {
  if (it.outOfStock) return true;
  if (it.quantity == null || it.minQuantity == null) return false;
  return it.quantity < it.minQuantity;
}

// ───────────────────────── Nutrition & cost ─────────────────────────

export interface RecipeNutrition {
  perServing: Nutrients;
  /** grams per serving (for calorie density) */
  gramsPerServing: number;
  /** kcal per gram */
  density: number;
  /** fraction of ingredients we could convert to grams (transparency) */
  coverage: number;
  overridden: boolean;
}

const COOKED_FACTOR: Record<string, number> = {
  'basmati-rice': 3, pasta: 2.2, 'protein-pasta': 2.2, vermicelli: 2.5, oats: 2.5, rajma: 2.6, chana: 2.4, 'toor-dal': 3, atta: 1.4,
};

export function recipeNutrition(r: Recipe, im: IngMap, servings = r.servings): RecipeNutrition {
  let total = { ...ZERO };
  let grams = 0;
  let ok = 0;
  for (const ri of r.ingredients) {
    if (ri.optional) { ok++; continue; }
    const ing = im.get(ri.ingredientId);
    const g = toGrams(ri.quantity, ri.unit, ing);
    if (g == null) continue;
    ok++;
    // dry grains/legumes absorb water when cooked → count cooked weight for density
    grams += g * (COOKED_FACTOR[ri.ingredientId] ?? 1);
    if (ing?.per100g) total = addN(total, ing.per100g, g / 100);
  }
  const per = r.nutritionOverride ?? scaleN(total, 1 / Math.max(1, r.servings));
  const gps = grams / Math.max(1, r.servings);
  // cooked grain/legume weight roughly ×2.5 — use a light correction for density
  return {
    perServing: per,
    gramsPerServing: gps,
    density: gps > 0 ? per.kcal / gps : 0,
    coverage: r.ingredients.length ? ok / r.ingredients.length : 1,
    overridden: !!r.nutritionOverride,
  };
}

/** Price per gram for an ingredient (uses latest store price record if given). */
export function unitPrice(d: Pick<AppData, 'prices'>, ing: Ingredient | undefined, storeId?: string): { perGram: number | null; perPkg: number | null; source: PriceSource; pkgQty?: number; pkgUnit?: Unit } {
  if (!ing) return { perGram: null, perPkg: null, source: 'estimate' };
  const recs = d.prices
    .filter((p) => p.ingredientId === ing.id && (!storeId || p.storeId === storeId))
    .sort((a, b) => b.checkedAt.localeCompare(a.checkedAt));
  const rec = recs[0];
  if (rec) {
    const g = toGrams(rec.packageQty, rec.packageUnit, ing);
    return { perGram: g ? rec.price / g : null, perPkg: rec.price, source: rec.source, pkgQty: rec.packageQty, pkgUnit: rec.packageUnit };
  }
  if (ing.packagePrice != null && ing.packageQty && ing.packageUnit) {
    const g = toGrams(ing.packageQty, ing.packageUnit, ing);
    return { perGram: g ? ing.packagePrice / g : null, perPkg: ing.packagePrice, source: ing.priceSource ?? 'estimate', pkgQty: ing.packageQty, pkgUnit: ing.packageUnit };
  }
  return { perGram: null, perPkg: null, source: 'estimate' };
}

export function recipeCostPerServing(d: Pick<AppData, 'prices'>, r: Recipe, im: IngMap): number {
  let total = 0;
  for (const ri of r.ingredients) {
    if (ri.optional) continue;
    const ing = im.get(ri.ingredientId);
    const p = unitPrice(d, ing);
    const g = toGrams(ri.quantity, ri.unit, ing);
    if (p.perGram != null && g != null) total += p.perGram * g;
  }
  return total / Math.max(1, r.servings);
}

// ───────────────────────── Availability ─────────────────────────

export type IngStatus = 'have' | 'verify' | 'partial' | 'substitute' | 'missing';

export interface IngAvailability {
  ri: RecipeIngredient;
  ing?: Ingredient;
  need: number; // in ri.unit (scaled)
  have: number | null; // in ri.unit, null if unknown
  status: IngStatus;
  substituteId?: string;
  expiringSoon: boolean;
  shortfallCost: number;
}

export type AvailabilityLabel = 'can-make' | 'substitutions' | 'missing-few' | 'shopping';

export interface RecipeAvailability {
  items: IngAvailability[];
  label: AvailabilityLabel;
  missingCount: number;
  usesExpiring: boolean;
  extraCost: number;
}

export function recipeAvailability(d: AppData, r: Recipe, im: IngMap, servings = r.servings): RecipeAvailability {
  const k = servings / Math.max(1, r.servings);
  const items: IngAvailability[] = [];
  let missing = 0;
  let subs = 0;
  let usesExpiring = false;
  let extra = 0;
  for (const ri of r.ingredients) {
    const ing = im.get(ri.ingredientId);
    const need = ri.quantity * k;
    const st = stockFor(d, im, ri.ingredientId, ri.unit);
    const expSoon = !!st.earliestExpiry && daysUntil(st.earliestExpiry) <= 3;
    if (expSoon) usesExpiring = true;
    let status: IngStatus;
    let have: number | null = st.known;
    let substituteId: string | undefined;
    if (!st.present) {
      have = 0;
      const sub = ing?.substitutes?.find((s) => stockFor(d, im, s, ri.unit).present);
      if (sub) { status = 'substitute'; substituteId = sub; }
      else status = 'missing';
    } else if (st.known >= need - 1e-6) {
      status = 'have';
    } else if (st.unknown) {
      status = 'verify';
      have = st.known > 0 ? st.known : null;
    } else {
      status = 'partial';
    }
    let shortfallCost = 0;
    if (status === 'missing' || status === 'partial') {
      const short = need - (have ?? 0);
      const p = unitPrice(d, ing);
      const g = toGrams(short, ri.unit, ing);
      if (p.perPkg != null && p.pkgQty && p.pkgUnit) {
        const inPkg = convert(short, ri.unit, p.pkgUnit, ing);
        shortfallCost = inPkg != null ? Math.ceil(inPkg / p.pkgQty - 1e-9) * p.perPkg : p.perPkg;
      } else if (p.perGram != null && g != null) shortfallCost = p.perGram * g;
      if (!ri.optional) { extra += shortfallCost; missing++; }
    }
    if (status === 'substitute' && !ri.optional) subs++;
    items.push({ ri, ing, need, have, status, substituteId, expiringSoon: expSoon, shortfallCost });
  }
  let label: AvailabilityLabel;
  if (missing === 0 && subs === 0) label = 'can-make';
  else if (missing === 0) label = 'substitutions';
  else if (missing <= 2) label = 'missing-few';
  else label = 'shopping';
  return { items, label, missingCount: missing, usesExpiring, extraCost: extra };
}

export const LABEL_TEXT: Record<AvailabilityLabel, string> = {
  'can-make': 'Can make now',
  substitutions: 'Can make with substitutions',
  'missing-few': 'Missing 1–2 ingredients',
  shopping: 'Requires grocery shopping',
};

// ───────────────────────── Deductions ─────────────────────────

export interface Deduction {
  inventoryItemId: string | null;
  ingredientId: string;
  name: string;
  unit: Unit;
  before: number | null;
  after: number | null;
  /** amount deducted in item unit */
  amount: number;
  note?: string;
}

/**
 * Plan which inventory entries get deducted when cooking `servings` of a recipe.
 * Uses earliest-expiring entries first. Unknown-quantity entries are not deducted
 * (we can't subtract from an unknown) but are reported so the user can update them.
 */
export function planDeductions(d: AppData, r: Recipe, servings: number, im: IngMap): Deduction[] {
  const k = servings / Math.max(1, r.servings);
  const out: Deduction[] = [];
  for (const ri of r.ingredients) {
    const ing = im.get(ri.ingredientId);
    let remaining = ri.quantity * k;
    const items = d.inventory
      .filter((i) => i.ingredientId === ri.ingredientId && isInStock(i))
      .sort((a, b) => (a.expirationDate ?? '9999').localeCompare(b.expirationDate ?? '9999'));
    if (!items.length) {
      if (!ri.optional) out.push({ inventoryItemId: null, ingredientId: ri.ingredientId, name: ing?.name ?? ri.ingredientId, unit: ri.unit, before: null, after: null, amount: 0, note: 'Not in inventory — nothing to deduct' });
      continue;
    }
    for (const it of items) {
      if (remaining <= 1e-9) break;
      if (it.quantity === null) {
        out.push({ inventoryItemId: it.id, ingredientId: ri.ingredientId, name: it.name, unit: it.unit, before: null, after: null, amount: 0, note: 'Quantity not specified — set it to track usage' });
        remaining = 0;
        break;
      }
      const needInItem = convert(remaining, ri.unit, it.unit, ing);
      if (needInItem == null) {
        out.push({ inventoryItemId: it.id, ingredientId: ri.ingredientId, name: it.name, unit: it.unit, before: it.quantity, after: it.quantity, amount: 0, note: `Can't convert ${ri.unit} → ${it.unit}; adjust manually` });
        remaining = 0;
        break;
      }
      const take = Math.min(it.quantity, needInItem);
      const after = round4(it.quantity - take);
      out.push({ inventoryItemId: it.id, ingredientId: ri.ingredientId, name: it.name, unit: it.unit, before: it.quantity, after, amount: round4(take) });
      const leftover = needInItem - take;
      remaining = leftover <= 1e-9 ? 0 : (convert(leftover, it.unit, ri.unit, ing) ?? 0);
    }
    if (remaining > 1e-6 && !ri.optional) {
      const last = out[out.length - 1];
      if (last && last.ingredientId === ri.ingredientId && !last.note) last.note = 'Not enough in stock — deducted what was available';
    }
  }
  return out;
}

const round4 = (v: number) => Math.round(v * 10000) / 10000;

// ───────────────────────── Grocery generation ─────────────────────────

export interface Selection { recipeId: string; servings: number }

export interface GroceryOptions {
  storeId?: string;
  includeLowStock?: boolean;
  includeNonFood?: boolean;
}

function baseUnitFor(ing: Ingredient | undefined, u: Unit): Unit {
  if (!ing) return u;
  const target = ing.packageUnit ?? ing.defaultUnit;
  if (convert(1, u, target, ing) != null) return target;
  if (gramsPerUnit(u, ing) != null) return 'g';
  return u;
}

export function priceFor(d: AppData, ing: Ingredient | undefined, qty: number, unit: Unit, storeId?: string): { qty: number; unit: Unit; cost: number; source: PriceSource; packs?: number } {
  const p = unitPrice(d, ing, storeId);
  if (p.perPkg != null && p.pkgQty && p.pkgUnit) {
    const inPkg = convert(qty, unit, p.pkgUnit, ing);
    if (inPkg != null) {
      const packs = Math.max(1, Math.ceil(inPkg / p.pkgQty - 1e-9));
      return { qty: packs * p.pkgQty, unit: p.pkgUnit, cost: packs * p.perPkg, source: p.source, packs };
    }
  }
  const g = toGrams(qty, unit, ing);
  return { qty, unit, cost: p.perGram != null && g != null ? p.perGram * g : 0, source: p.source };
}

/**
 * Consolidate ingredient requirements for all selections, subtract inventory,
 * and return what to buy. Unknown-quantity stock is flagged for verification
 * instead of being treated as zero.
 */
export function buildGroceryItems(d: AppData, selections: Selection[], opts: GroceryOptions = {}): GroceryItem[] {
  const im = ingMap(d);
  const recipes = new Map(d.recipes.map((r) => [r.id, r]));
  const need = new Map<string, { qty: number; unit: Unit; recipes: Set<string>; optionalOnly: boolean }>();

  for (const s of selections) {
    const r = recipes.get(s.recipeId);
    if (!r || s.servings <= 0) continue;
    const k = s.servings / Math.max(1, r.servings);
    for (const ri of r.ingredients) {
      const ing = im.get(ri.ingredientId);
      const cur = need.get(ri.ingredientId);
      const unit = cur?.unit ?? baseUnitFor(ing, ri.unit);
      const q = convert(ri.quantity * k, ri.unit, unit, ing);
      if (q == null) continue; // incompatible units; skip rather than mis-add
      if (cur) {
        cur.qty += q;
        cur.recipes.add(r.name);
        cur.optionalOnly = cur.optionalOnly && !!ri.optional;
      } else need.set(ri.ingredientId, { qty: q, unit, recipes: new Set([r.name]), optionalOnly: !!ri.optional });
    }
  }

  const items: GroceryItem[] = [];
  for (const [id, n] of need) {
    const ing = im.get(id);
    if (n.optionalOnly) continue;
    if (ing?.nonFood && !opts.includeNonFood) continue;
    const st = stockFor(d, im, id, n.unit);
    const have = st.known;
    if (st.present && st.unknown && have < n.qty) {
      // Unknown quantity → verify, never assume zero.
      const pr = priceFor(d, ing, n.qty - have, n.unit, opts.storeId);
      items.push(mkItem(ing, id, {
        quantity: pr.qty, unit: pr.unit, neededQty: n.qty, haveQty: null, estPrice: pr.cost, priceSource: pr.source,
        essential: true, verify: true, alreadyHave: !!ing?.staple, reason: 'recipe', forRecipes: [...n.recipes], storeId: opts.storeId ?? ing?.preferredStoreId,
      }));
      continue;
    }
    const short = n.qty - have;
    if (short <= 1e-6) continue; // enough in stock → no purchase
    const pr = priceFor(d, ing, short, n.unit, opts.storeId);
    items.push(mkItem(ing, id, {
      quantity: pr.qty, unit: pr.unit, neededQty: convert(short, n.unit, pr.unit, ing) ?? short, haveQty: convert(have, n.unit, pr.unit, ing) ?? have,
      estPrice: pr.cost, priceSource: pr.source, essential: true, reason: 'recipe', forRecipes: [...n.recipes], storeId: opts.storeId ?? ing?.preferredStoreId,
    }));
  }

  if (opts.includeLowStock !== false) {
    const seen = new Set(items.map((i) => i.ingredientId));
    const byIng = new Map<string, InventoryItem[]>();
    for (const it of d.inventory) byIng.set(it.ingredientId, [...(byIng.get(it.ingredientId) ?? []), it]);
    for (const [id, its] of byIng) {
      if (seen.has(id)) continue;
      const ing = im.get(id);
      if (ing?.nonFood && !opts.includeNonFood) continue;
      const anyIn = its.some((i) => isInStock(i) && !isLowStock(i));
      const low = its.find((i) => isLowStock(i) && (i.frequent || i.minQuantity != null));
      if (anyIn || !low) continue;
      const target = low.minQuantity ?? (ing?.packageQty ?? 1);
      const shortBy = Math.max(target - (low.quantity ?? 0), 0) || target;
      const pr = priceFor(d, ing, shortBy, low.unit, opts.storeId);
      items.push(mkItem(ing, id, {
        name: low.name, quantity: pr.qty, unit: pr.unit, neededQty: shortBy, haveQty: low.quantity, estPrice: pr.cost, priceSource: pr.source,
        essential: false, reason: 'low-stock', storeId: opts.storeId ?? ing?.preferredStoreId,
      }));
    }
  }
  return items;
}

function mkItem(ing: Ingredient | undefined, id: string, p: Partial<GroceryItem> & Pick<GroceryItem, 'quantity' | 'unit' | 'estPrice' | 'priceSource' | 'essential' | 'reason'>): GroceryItem {
  return {
    id: uid('gi-'),
    ingredientId: id,
    name: ing?.name ?? id,
    category: ing?.category ?? 'other',
    checked: false,
    location: ing?.defaultLocation,
    ...p,
  };
}

export function listTotal(items: GroceryItem[]): number {
  return items.filter((i) => !i.removed && !i.alreadyHave).reduce((s, i) => s + (i.estPrice || 0), 0);
}

// ───────────────────────── Budget fitting ─────────────────────────

export interface BudgetSuggestion {
  id: string;
  type: 'remove' | 'substitute' | 'reduce';
  itemId: string;
  label: string;
  saves: number;
  toIngredientId?: string;
}

const LOW_PRIORITY_CATS = new Set(['snacks', 'drinks', 'household', 'other']);

/** Rank items by necessity (higher = keep). */
export function necessity(i: GroceryItem, im: IngMap): number {
  let s = i.essential ? 100 : 30;
  const ing = i.ingredientId ? im.get(i.ingredientId) : undefined;
  if (ing?.per100g && ing.per100g.kcal > 0) s += Math.min(30, (ing.per100g.protein * 4 / ing.per100g.kcal) * 60); // protein density
  if (i.category === 'vegetables' || i.category === 'fruits' || i.category === 'legumes') s += 10;
  if (LOW_PRIORITY_CATS.has(i.category)) s -= 25;
  if (i.category === 'water') s += 5;
  return s;
}

export function budgetSuggestions(d: AppData, items: GroceryItem[], budget: number, storeId?: string): BudgetSuggestion[] {
  const im = ingMap(d);
  const active = items.filter((i) => !i.removed && !i.alreadyHave);
  const total = listTotal(items);
  if (total <= budget) return [];
  const out: BudgetSuggestion[] = [];
  // 1. cheaper substitutes for anything
  for (const i of active) {
    const ing = i.ingredientId ? im.get(i.ingredientId) : undefined;
    for (const altId of ing?.cheaperAlternatives ?? []) {
      const alt = im.get(altId);
      if (!alt) continue;
      const qty = i.neededQty ?? i.quantity;
      const fromUnit = i.unit;
      const conv = convert(qty, fromUnit, alt.packageUnit ?? alt.defaultUnit, alt) ?? convert(qty, fromUnit, 'g', ing);
      const pr = conv != null ? priceFor(d, alt, convert(qty, fromUnit, 'g', ing) ?? qty, 'g', storeId) : null;
      if (pr && pr.cost < i.estPrice - 0.25) {
        out.push({ id: uid('bs-'), type: 'substitute', itemId: i.id, toIngredientId: altId, label: `Swap ${i.name} → ${alt.name}`, saves: i.estPrice - pr.cost });
      }
    }
  }
  // 2. optional / non-essential items, least necessary first
  const optional = active.filter((i) => !i.essential).sort((a, b) => necessity(a, im) - necessity(b, im));
  for (const i of optional) out.push({ id: uid('bs-'), type: 'remove', itemId: i.id, label: `Skip ${i.name} (optional restock)`, saves: i.estPrice });
  // 3. essential items: suggest only if still over, clearly labelled
  const essentials = active.filter((i) => i.essential && !i.verify).sort((a, b) => necessity(a, im) - necessity(b, im));
  for (const i of essentials.slice(0, 3)) out.push({ id: uid('bs-'), type: 'remove', itemId: i.id, label: `Postpone ${i.name} (needed for: ${(i.forRecipes ?? []).slice(0, 2).join(', ') || 'planned meals'})`, saves: i.estPrice });
  return out;
}

/** Apply a substitution to a grocery item list (returns new list). */
export function applySubstitute(d: AppData, items: GroceryItem[], itemId: string, toIngredientId: string, storeId?: string): GroceryItem[] {
  const im = ingMap(d);
  return items.map((i) => {
    if (i.id !== itemId) return i;
    const ing = i.ingredientId ? im.get(i.ingredientId) : undefined;
    const alt = im.get(toIngredientId)!;
    const g = toGrams(i.neededQty ?? i.quantity, i.unit, ing) ?? 0;
    const pr = priceFor(d, alt, g, 'g', storeId);
    return { ...i, ingredientId: alt.id, name: `${alt.name} (instead of ${i.name})`, category: alt.category, quantity: pr.qty, unit: pr.unit, estPrice: pr.cost, priceSource: pr.source, reason: 'substitute', location: alt.defaultLocation };
  });
}

// ───────────────────────── Suggestions ─────────────────────────

export type Mood =
  | 'very-hungry' | 'moderate' | 'not-hungry' | 'quick' | 'tasty' | 'stressed'
  | 'craving' | 'bored' | 'no-cook' | 'sweet' | 'crunchy' | 'filling-dinner' | 'physically-hungry';

export interface Suggestion {
  kind: 'recipe' | 'prepared';
  recipe?: Recipe;
  prepared?: PreparedMeal;
  score: number;
  why: string[];
  availability?: RecipeAvailability;
  nutrition?: Nutrients;
}

const AV_SCORE: Record<AvailabilityLabel, number> = { 'can-make': 40, substitutions: 28, 'missing-few': 8, shopping: -20 };

export function scoreRecipe(d: AppData, r: Recipe, im: IngMap, mood?: Mood) {
  const av = recipeAvailability(d, r, im, 1 * r.servings);
  const nu = recipeNutrition(r, im);
  const p = nu.perServing;
  const why: string[] = [];
  let s = AV_SCORE[av.label];
  if (av.label === 'can-make') why.push('You have everything');
  if (av.usesExpiring) { s += 15; why.push('Uses ingredients expiring soon'); }
  s += Math.min(25, p.protein * 0.6);
  if (p.protein >= 30) why.push(`${Math.round(p.protein)} g protein`);
  if (r.tags.includes('very-filling')) s += 8;
  if (r.favorite) s += 6;
  if (r.rating) s += r.rating;
  const t = r.prepMin + r.cookMin;
  const has = (tag: string) => r.tags.includes(tag as never);
  switch (mood) {
    case 'very-hungry':
    case 'physically-hungry':
    case 'filling-dinner':
      if (has('very-filling')) { s += 25; why.push('Very filling'); }
      if (has('lower-calorie-density')) s += 12;
      if (p.fiber >= 6) { s += 8; why.push(`${Math.round(p.fiber)} g fiber`); }
      if (mood === 'filling-dinner' && (r.category === 'dinner' || has('evening-meal'))) s += 15;
      if (r.category === 'snack' && mood !== 'physically-hungry') s -= 15;
      break;
    case 'moderate':
      if (r.category === 'lunch' || r.category === 'dinner' || r.category === 'breakfast') s += 6;
      break;
    case 'not-hungry':
      if (has('light')) { s += 25; why.push('Lighter option'); }
      if (p.kcal < 350) s += 12;
      if (has('very-filling')) s -= 10;
      break;
    case 'quick':
    case 'stressed':
    case 'no-cook':
      if (t <= 10) { s += 25; why.push(`${t} min`); } else if (t <= 15) s += 15; else if (t > 30) s -= 25;
      if (has('no-cook')) s += mood === 'no-cook' ? 25 : 10;
      break;
    case 'tasty':
    case 'craving':
      if (has('craving-friendly')) { s += 25; why.push('Hits the craving'); }
      break;
    case 'sweet':
      if (has('sweet')) { s += 35; why.push('Sweet'); } else s -= 20;
      break;
    case 'crunchy':
      if (has('crunchy')) { s += 35; why.push('Crunchy'); } else s -= 15;
      break;
    case 'bored':
      if (has('craving-friendly') || has('quick')) s += 10;
      if (r.category === 'snack') s += 10;
      break;
  }
  return { score: s, why, av, nu };
}

export function suggestFor(d: AppData, mood: Mood | undefined, limit = 6, filter?: (r: Recipe) => boolean): Suggestion[] {
  const im = ingMap(d);
  const out: Suggestion[] = [];
  const preparedBoost = mood === 'stressed' || mood === 'quick' || mood === 'no-cook' || mood === 'very-hungry' || mood === 'physically-hungry' || mood === 'filling-dinner';
  for (const pm of d.prepared.filter((p) => p.servings > 0)) {
    const exp = pm.expirationDate ? daysUntil(pm.expirationDate) : 99;
    if (exp < 0) continue;
    let s = 60 + (preparedBoost ? 40 : 0) + (exp <= 2 ? 15 : 0);
    if (mood === 'sweet' || mood === 'crunchy' || mood === 'not-hungry') s -= 40;
    const why = ['Already prepared — just reheat'];
    if (exp <= 2) why.push('Eat soon');
    out.push({ kind: 'prepared', prepared: pm, score: s, why, nutrition: pm.nutrition });
  }
  for (const r of d.recipes) {
    if (filter && !filter(r)) continue;
    const { score, why, av, nu } = scoreRecipe(d, r, im, mood);
    out.push({ kind: 'recipe', recipe: r, score, why, availability: av, nutrition: nu.perServing });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Unit-safe add of qty in `unit` into an inventory item; returns new quantity or null if incompatible. */
export function addToItem(it: InventoryItem, qty: number, unit: Unit, ing?: Ingredient): number | null {
  const c = convert(qty, unit, it.unit, ing);
  if (c == null) return null;
  return round4((it.quantity ?? 0) + c);
}

export { kind };
