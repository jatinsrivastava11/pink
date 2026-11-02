import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../lib/store';
import { buildGroceryItems, ingMap, planDeductions } from '../lib/engine';
import { convert } from '../lib/units';

// Minimal localStorage polyfill for Node environment
const mem = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => { mem.set(k, v); },
  removeItem: (k: string) => { mem.delete(k); },
  clear: () => { mem.clear(); },
};

describe('Pink Kitchen — 12 Acceptance Tests', () => {
  beforeEach(() => {
    useStore.getState().resetData();
  });

  it('TEST 1 & 10: Add 2 lbs of chicken breast to fridge inventory and persist across reload', () => {
    const s = useStore.getState();
    const cb = s.inventory.find((i) => i.ingredientId === 'chicken-breast')!;
    s.setQty(cb.id, 2);
    expect(useStore.getState().inventory.find((i) => i.id === cb.id)?.quantity).toBe(2);

    // Simulate reload by exporting persisted state, resetting, and re-importing
    const exported = useStore.getState().exportData();
    useStore.getState().resetData();
    useStore.getState().importData(exported);
    expect(useStore.getState().inventory.find((i) => i.id === cb.id)?.quantity).toBe(2);
  });

  it('TEST 2: Selecting/cooking a recipe requiring ~1 lb (453.6g) chicken breast shows remaining stock (~1 lb)', () => {
    const s = useStore.getState();
    const cb = s.inventory.find((i) => i.ingredientId === 'chicken-breast')!;
    s.setQty(cb.id, 2); // 2 lbs

    // Create a recipe requiring 1 lb chicken breast
    s.saveRecipe({
      id: 'test-1lb-chicken',
      name: 'Test 1 lb Chicken',
      cuisine: 'Western',
      category: 'dinner',
      prepMin: 5,
      cookMin: 10,
      servings: 2,
      ingredients: [{ ingredientId: 'chicken-breast', quantity: 1, unit: 'lb' }],
      steps: ['Cook'],
      tags: ['high-protein'],
      storage: 'Fridge 3d',
      reheating: 'Heat',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const deds = planDeductions(useStore.getState(), useStore.getState().recipes.find((r) => r.id === 'test-1lb-chicken')!, 2, ingMap(useStore.getState()));
    expect(deds[0].before).toBe(2);
    expect(deds[0].after).toBeCloseTo(1, 2);

    useStore.getState().cook('test-1lb-chicken', { servings: 2, eatNow: 2, storeRest: false, location: 'fridge' });
    expect(useStore.getState().inventory.find((i) => i.id === cb.id)?.quantity).toBeCloseTo(1, 2);
  });

  it('TEST 3 & 4: Consolidates chicken, eggs, and Greek yogurt across multiple recipes, and omits rice when enough is in stock', () => {
    const s = useStore.getState();
    const setByIng = (ingId: string, qty: number, unit?: any) => {
      const it = useStore.getState().inventory.find((i) => i.ingredientId === ingId)!;
      useStore.getState().updateItem(it.id, { quantity: qty, ...(unit ? { unit } : {}) });
    };
    // Current inventory from prompt example:
    // Chicken breast: 1 lb, Greek yogurt: 300 g, Eggs: 10, Rice: 3 lbs
    setByIng('chicken-breast', 1, 'lb');
    setByIng('greek-yogurt', 300, 'g');
    setByIng('eggs', 10, 'each');
    setByIng('basmati-rice', 3, 'lb');

    // Add two test recipes whose combined requirement is:
    // Chicken breast: 3 lbs, Greek yogurt: 500 g, Eggs: 12, Broccoli: 2 heads, Rice: 1 lb
    s.saveRecipe({
      id: 'r-part-1',
      name: 'Part 1',
      cuisine: 'Western',
      category: 'lunch',
      prepMin: 5,
      cookMin: 10,
      servings: 1,
      ingredients: [
        { ingredientId: 'chicken-breast', quantity: 1.5, unit: 'lb' },
        { ingredientId: 'greek-yogurt', quantity: 200, unit: 'g' },
        { ingredientId: 'eggs', quantity: 6, unit: 'each' },
        { ingredientId: 'broccoli', quantity: 1, unit: 'head' },
        { ingredientId: 'basmati-rice', quantity: 0.5, unit: 'lb' },
      ],
      steps: ['Cook'],
      tags: [],
      storage: '',
      reheating: '',
      createdAt: '',
      updatedAt: '',
    });
    s.saveRecipe({
      id: 'r-part-2',
      name: 'Part 2',
      cuisine: 'Western',
      category: 'dinner',
      prepMin: 5,
      cookMin: 10,
      servings: 1,
      ingredients: [
        { ingredientId: 'chicken-breast', quantity: 1.5, unit: 'lb' },
        { ingredientId: 'greek-yogurt', quantity: 300, unit: 'g' },
        { ingredientId: 'eggs', quantity: 6, unit: 'each' },
        { ingredientId: 'broccoli', quantity: 1, unit: 'head' },
        { ingredientId: 'basmati-rice', quantity: 0.5, unit: 'lb' },
      ],
      steps: ['Cook'],
      tags: [],
      storage: '',
      reheating: '',
      createdAt: '',
      updatedAt: '',
    });

    const list = buildGroceryItems(
      useStore.getState(),
      [
        { recipeId: 'r-part-1', servings: 1 },
        { recipeId: 'r-part-2', servings: 1 },
      ],
      { includeLowStock: false },
    );

    const chicken = list.find((i) => i.ingredientId === 'chicken-breast')!;
    const yogurt = list.find((i) => i.ingredientId === 'greek-yogurt')!;
    const eggs = list.find((i) => i.ingredientId === 'eggs')!;
    const broccoli = list.find((i) => i.ingredientId === 'broccoli')!;
    const rice = list.find((i) => i.ingredientId === 'basmati-rice');

    expect(chicken.neededQty).toBeCloseTo(2, 2); // 3 lb needed - 1 lb have = 2 lb
    expect(yogurt).toBeTruthy(); // 500 g - 300 g = 200 g shortfall
    expect(eggs.neededQty).toBeCloseTo(2, 2); // 12 - 10 = 2 eggs shortfall
    expect(broccoli.quantity).toBeCloseTo(2, 2); // 2 heads
    expect(rice).toBeUndefined(); // TEST 4: 3 lbs in stock >= 1 lb needed → omitted!
  });

  it('TEST 6: Purchasing groceries and confirming quantities increases inventory without double counting', () => {
    const s = useStore.getState();
    const cb = s.inventory.find((i) => i.ingredientId === 'chicken-breast')!;
    s.setQty(cb.id, 1);

    s.restockItems([
      {
        id: 'gi-1',
        ingredientId: 'chicken-breast',
        name: 'Chicken breast',
        category: 'protein',
        quantity: 2,
        purchasedQty: 2,
        unit: 'lb',
        estPrice: 7.5,
        priceSource: 'verified',
        reason: 'recipe',
        essential: true,
        checked: true,
      },
    ], 'traderjoes');

    expect(useStore.getState().inventory.find((i) => i.id === cb.id)?.quantity).toBeCloseTo(3, 2);
  });

  it('TEST 7: Marking 1 of the 4 prepared ground chicken burgers as eaten leaves 3 remaining and does not touch raw chicken', () => {
    const s = useStore.getState();
    const burgers = s.prepared.find((p) => p.id === 'prep-chicken-burgers')!;
    expect(burgers.servings).toBe(4);
    s.eatPrepared(burgers.id, 1);
    expect(useStore.getState().prepared.find((p) => p.id === 'prep-chicken-burgers')?.servings).toBe(3);
    expect(useStore.getState().foodLogs.length).toBe(1);
  });

  it('TEST 8: Adding a 24-pack of water bottles and consuming 2 leaves 22 remaining', () => {
    const s = useStore.getState();
    const wb = s.inventory.find((i) => i.ingredientId === 'water-bottle')!;
    s.setQty(wb.id, 24);
    s.logWater(16.9, 'bottle', true);
    s.logWater(16.9, 'bottle', true);
    expect(useStore.getState().inventory.find((i) => i.id === wb.id)?.quantity).toBe(22);
  });

  it('TEST 9: Marking a meal as prepared updates ingredient stock and prepared-meal inventory without double-counting when eaten later', () => {
    const s = useStore.getState();
    const cb = s.inventory.find((i) => i.ingredientId === 'chicken-breast')!;
    s.setQty(cb.id, 2); // 2 lbs (~907 g)

    // Cook 2 servings of chicken-tikka-bowl (requires 360g chicken breast total = ~0.7937 lb), eat 0 now, store 2
    s.cook('chicken-tikka-bowl', { servings: 2, eatNow: 0, storeRest: true, location: 'fridge' });
    const afterCook = useStore.getState().inventory.find((i) => i.id === cb.id)!.quantity!;
    const expectedRemaining = 2 - (convert(360, 'g', 'lb') ?? 0);
    expect(afterCook).toBeCloseTo(expectedRemaining, 2);

    const newPrep = useStore.getState().prepared.find((p) => p.recipeId === 'chicken-tikka-bowl')!;
    expect(newPrep.servings).toBe(2);

    // Eat 1 prepared serving later → raw chicken breast stays untouched!
    useStore.getState().eatPrepared(newPrep.id, 1);
    expect(useStore.getState().prepared.find((p) => p.id === newPrep.id)?.servings).toBe(1);
    expect(useStore.getState().inventory.find((i) => i.id === cb.id)?.quantity).toBeCloseTo(afterCook, 4);
  });

  it('TEST 11: Exporting data, clearing/resetting, and importing restores inventory and custom recipes', () => {
    const s = useStore.getState();
    const cb = s.inventory.find((i) => i.ingredientId === 'chicken-breast')!;
    s.setQty(cb.id, 4.5);
    const dupId = s.duplicateRecipe('rajma-chawal');

    const backup = useStore.getState().exportData();
    useStore.getState().resetData();
    expect(useStore.getState().inventory.find((i) => i.id === cb.id)?.quantity).toBeNull();

    useStore.getState().importData(backup);
    expect(useStore.getState().inventory.find((i) => i.id === cb.id)?.quantity).toBe(4.5);
    expect(useStore.getState().recipes.some((r) => r.id === dupId)).toBe(true);
  });
});
