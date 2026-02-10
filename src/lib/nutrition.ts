import type { Nutrients, UserPreferences } from '../types';

export const ZERO: Nutrients = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };

export function addN(a: Nutrients, b: Nutrients, k = 1): Nutrients {
  return {
    kcal: a.kcal + b.kcal * k,
    protein: a.protein + b.protein * k,
    carbs: a.carbs + b.carbs * k,
    fat: a.fat + b.fat * k,
    fiber: a.fiber + b.fiber * k,
  };
}

export function scaleN(a: Nutrients, k: number): Nutrients {
  return addN(ZERO, a, k);
}

export function roundN(a: Nutrients): Nutrients {
  return {
    kcal: Math.round(a.kcal),
    protein: Math.round(a.protein),
    carbs: Math.round(a.carbs),
    fat: Math.round(a.fat),
    fiber: Math.round(a.fiber),
  };
}

/**
 * Mifflin-St Jeor BMR × activity factor. Returns an *estimate* of maintenance
 * calories. Only used as a suggestion that the user must confirm.
 */
export function estimateMaintenance(p: Pick<UserPreferences, 'age' | 'sex' | 'heightIn' | 'weightLb' | 'activity'>): number | null {
  if (!p.age) return null;
  const kg = p.weightLb * 0.453592;
  const cm = p.heightIn * 2.54;
  const bmr = 10 * kg + 6.25 * cm - 5 * p.age + (p.sex === 'male' ? 5 : -161);
  const f = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725 }[p.activity];
  return Math.round(bmr * f);
}

/** Moderate, sustainable target: ~15% below maintenance, never below 1800 for this profile type. */
export function suggestTarget(maint: number | null): number | null {
  if (!maint) return null;
  const t = Math.round((maint * 0.85) / 50) * 50;
  return Math.max(t, 1800);
}

export function bmi(heightIn: number, weightLb: number): number {
  return (703 * weightLb) / (heightIn * heightIn);
}
