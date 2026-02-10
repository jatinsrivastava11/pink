import type { Ingredient, Unit } from '../types';

export const MASS: Partial<Record<Unit, number>> = { g: 1, kg: 1000, oz: 28.3495, lb: 453.592 };
export const VOLUME: Partial<Record<Unit, number>> = {
  ml: 1, l: 1000, tsp: 4.92892, tbsp: 14.7868, cup: 236.588, floz: 29.5735, gal: 3785.41,
};
export const COUNT_UNITS: Unit[] = ['each', 'slice', 'clove', 'can', 'container', 'bottle', 'pack', 'bag', 'box', 'jar', 'head', 'bunch', 'dozen'];

export const ALL_UNITS: Unit[] = ['g', 'kg', 'oz', 'lb', 'ml', 'l', 'tsp', 'tbsp', 'cup', 'floz', 'gal', ...COUNT_UNITS];

export const UNIT_LABEL: Record<Unit, string> = {
  g: 'g', kg: 'kg', oz: 'oz', lb: 'lb', ml: 'ml', l: 'L', tsp: 'tsp', tbsp: 'tbsp', cup: 'cup', floz: 'fl oz', gal: 'gal',
  each: 'units', slice: 'slices', clove: 'cloves', can: 'cans', container: 'containers', bottle: 'bottles', pack: 'packs',
  bag: 'bags', box: 'boxes', jar: 'jars', head: 'heads', bunch: 'bunches', dozen: 'dozen',
};
const SINGULAR: Partial<Record<Unit, string>> = {
  each: 'unit', slice: 'slice', clove: 'clove', can: 'can', container: 'container', bottle: 'bottle', pack: 'pack',
  bag: 'bag', box: 'box', jar: 'jar', head: 'head', bunch: 'bunch', cup: 'cup',
};

export function unitLabel(u: Unit, qty?: number | null): string {
  if (qty === 1 && SINGULAR[u]) return SINGULAR[u]!;
  return UNIT_LABEL[u] ?? u;
}

export function kind(u: Unit): 'mass' | 'volume' | 'count' {
  if (MASS[u] != null) return 'mass';
  if (VOLUME[u] != null) return 'volume';
  return 'count';
}

/** grams per one `unit` for the given ingredient, or null if not convertible. */
export function gramsPerUnit(u: Unit, ing?: Ingredient): number | null {
  if (MASS[u] != null) return MASS[u]!;
  if (VOLUME[u] != null) return VOLUME[u]! * (ing?.density ?? 1);
  if (u === 'dozen') {
    const each = ing?.unitWeights?.each;
    return ing?.unitWeights?.dozen ?? (each ? each * 12 : null);
  }
  const w = ing?.unitWeights?.[u];
  return w ?? null;
}

/**
 * Convert a quantity between units for an ingredient.
 * Returns null when the conversion is impossible (e.g. "bag" with no known weight).
 */
export function convert(qty: number, from: Unit, to: Unit, ing?: Ingredient): number | null {
  if (from === to) return qty;
  const kf = kind(from), kt = kind(to);
  if (kf === 'mass' && kt === 'mass') return (qty * MASS[from]!) / MASS[to]!;
  if (kf === 'volume' && kt === 'volume') return (qty * VOLUME[from]!) / VOLUME[to]!;
  if (from === 'dozen' && to === 'each') return qty * 12;
  if (from === 'each' && to === 'dozen') return qty / 12;
  const gf = gramsPerUnit(from, ing);
  const gt = gramsPerUnit(to, ing);
  if (gf == null || gt == null) return null;
  return (qty * gf) / gt;
}

export function toGrams(qty: number, u: Unit, ing?: Ingredient): number | null {
  const g = gramsPerUnit(u, ing);
  return g == null ? null : qty * g;
}

export function round(v: number, step = 0.01): number {
  return Math.round(v / step) * step;
}

/** Friendly number formatting: integers stay integers, others up to 2 decimals. */
export function fmtQty(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return '—';
  if (Math.abs(v - Math.round(v)) < 0.005) return String(Math.round(v));
  if (Math.abs(v) >= 10) return v.toFixed(1).replace(/\.0$/, '');
  return v.toFixed(2).replace(/0$/, '').replace(/\.0$/, '');
}

export function fmtQU(v: number | null | undefined, u: Unit): string {
  if (v == null) return 'Qty not specified';
  return `${fmtQty(v)} ${unitLabel(u, v)}`;
}

/** Step size for +/- controls depending on unit. */
export function stepFor(u: Unit): number {
  switch (u) {
    case 'lb': return 0.25;
    case 'kg': return 0.1;
    case 'gal': return 0.25;
    case 'g': return 50;
    case 'ml': return 50;
    case 'oz': return 1;
    case 'floz': return 1;
    case 'cup': return 0.5;
    default: return 1;
  }
}

export function money(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return '—';
  return `$${v.toFixed(2)}`;
}
