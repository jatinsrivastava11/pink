import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';
import type {
  AppData, FoodLog, GroceryItem, Ingredient, InventoryItem, Location, MealPlanEntry, Nutrients, PreparedMeal, PriceRecord,
  Recipe, ShoppingTrip, Store, Unit, UserPreferences, WaterLog, WeightLog, WorkoutLog, MealSlot, PriceSource,
} from '../types';
import { buildSeedData, DATA_VERSION } from '../data/seed';
import { seedIngredients } from '../data/ingredients';
import { seedRecipes } from '../data/recipes';
import { addDays, nowTime, todayISO, uid, weekStart } from './dates';
import { addToItem, ingMap, planDeductions, recipeNutrition, suggestFor, type Deduction } from './engine';
import { scaleN, roundN } from './nutrition';
import { convert } from './units';

export const STORAGE_KEY = 'pink-kitchen-data';
const LS_BACKUP_KEY = 'pink-kitchen-backup';

/**
 * IndexedDB is the primary store. A localStorage mirror is kept as a second
 * copy (best-effort) so data survives an IndexedDB hiccup.
 */
const idbStorage: StateStorage = {
  getItem: async (name) => {
    try {
      const v = await idbGet<string>(name);
      if (v != null) return v;
    } catch (e) {
      console.warn('IndexedDB read failed, falling back to localStorage', e);
    }
    return localStorage.getItem(LS_BACKUP_KEY);
  },
  setItem: async (name, value) => {
    try {
      await idbSet(name, value);
    } catch (e) {
      console.warn('IndexedDB write failed', e);
    }
    try {
      localStorage.setItem(LS_BACKUP_KEY, value);
    } catch {
      /* quota – IndexedDB copy is primary */
    }
  },
  removeItem: async (name) => {
    await idbDel(name);
    localStorage.removeItem(LS_BACKUP_KEY);
  },
};

const now = () => new Date().toISOString();

export interface CookOptions {
  servings: number;
  eatNow: number; // servings eaten right away
  storeRest: boolean; // add the rest to prepared meals
  location: string;
  fridgeDays?: number;
  preparedDate?: string;
  /** user-edited deduction amounts: inventoryItemId → new quantity */
  overrides?: Record<string, number>;
  planEntryId?: string;
}

interface Actions {
  hydrated: boolean;
  setHydrated: (v: boolean) => void;
  // prefs
  setPrefs: (p: Partial<UserPreferences>) => void;
  // inventory
  addItem: (it: Partial<InventoryItem> & Pick<InventoryItem, 'name'>) => string;
  updateItem: (id: string, p: Partial<InventoryItem>) => void;
  removeItem: (id: string) => void;
  removeItems: (ids: string[]) => void;
  adjustQty: (id: string, delta: number) => void;
  setQty: (id: string, qty: number | null) => void;
  markFinished: (id: string) => void;
  setOutOfStock: (id: string, out: boolean) => void;
  duplicateItem: (id: string) => void;
  bulkUpdate: (ids: string[], p: Partial<InventoryItem>) => void;
  addLocation: (name: string) => void;
  removeLocation: (id: string) => void;
  // ingredients & prices
  addIngredient: (i: Ingredient) => void;
  updateIngredient: (id: string, p: Partial<Ingredient>) => void;
  setPrice: (rec: Omit<PriceRecord, 'id'>) => void;
  // recipes
  saveRecipe: (r: Recipe) => void;
  deleteRecipe: (id: string) => void;
  duplicateRecipe: (id: string) => string;
  // prepared
  savePrepared: (p: PreparedMeal) => void;
  removePrepared: (id: string) => void;
  eatPrepared: (id: string, servings?: number, slot?: MealSlot) => void;
  cook: (recipeId: string, o: CookOptions) => Deduction[];
  // plan
  addEntry: (e: Omit<MealPlanEntry, 'id' | 'order'> & { order?: number }) => void;
  updateEntry: (id: string, p: Partial<MealPlanEntry>) => void;
  removeEntry: (id: string) => void;
  moveEntry: (id: string, date: string, beforeId?: string) => void;
  copyWeek: (fromWeekStart: string, toWeekStart: string) => number;
  generateWeek: (ws: string, opts?: { days?: number; replace?: boolean }) => void;
  clearWeek: (ws: string) => void;
  toggleWorkoutDay: (date: string) => void;
  markEntryEaten: (id: string) => void;
  // logs
  logFood: (f: Omit<FoodLog, 'id' | 'time' | 'date'> & { date?: string }) => void;
  removeFoodLog: (id: string) => void;
  logWater: (amountOz: number, kind: WaterLog['kind'], deductFromStock?: boolean) => void;
  removeWaterLog: (id: string) => void;
  addWeight: (w: Omit<WeightLog, 'id'>) => void;
  removeWeight: (id: string) => void;
  addWorkout: (w: Omit<WorkoutLog, 'id'>) => void;
  removeWorkout: (id: string) => void;
  addPhotoMeta: (id: string, date: string, note?: string) => void;
  removePhoto: (id: string) => void;
  // stores
  addStore: (name: string) => void;
  updateStore: (id: string, p: Partial<Store>) => void;
  removeStore: (id: string) => void;
  // grocery
  setDraftItems: (items: GroceryItem[]) => void;
  updateDraftItem: (id: string, p: Partial<GroceryItem>) => void;
  saveTrip: (t: ShoppingTrip) => void;
  removeTrip: (id: string) => void;
  completeTrip: (id: string, actualTotal: number, purchases: GroceryItem[]) => void;
  restockItems: (purchases: GroceryItem[], storeId?: string) => void;
  // data
  importData: (d: AppData) => void;
  resetData: () => void;
  exportData: () => AppData;
}

export type AppState = AppData & Actions;

function dataOnly(s: AppState): AppData {
  const { version, prefs, locations, ingredients, inventory, recipes, prepared, plan, stores, prices, trips, waterLogs, weightLogs, foodLogs, workoutLogs, photos, groceryDraft } = s;
  return { version, prefs, locations, ingredients, inventory, recipes, prepared, plan, stores, prices, trips, waterLogs, weightLogs, foodLogs, workoutLogs, photos, groceryDraft };
}

/** Make imported/persisted data safe: fill in missing collections and new seed ingredients/recipes. */
export function migrate(d: Partial<AppData>): AppData {
  const base = buildSeedData();
  const out: AppData = { ...base, ...d, prefs: { ...base.prefs, ...(d.prefs ?? {}) }, plan: { ...base.plan, ...(d.plan ?? {}) } } as AppData;
  // ensure every catalog ingredient exists (adds new seed ingredients after app updates)
  const have = new Set(out.ingredients.map((i) => i.id));
  for (const i of seedIngredients) if (!have.has(i.id)) out.ingredients.push(structuredClone(i));
  // add new seed recipes that never existed (don't resurrect deleted ones: tracked via ids list)
  const known = new Set((d as AppData & { knownSeedRecipeIds?: string[] }).knownSeedRecipeIds ?? out.recipes.map((r) => r.id));
  for (const r of seedRecipes) if (!known.has(r.id) && !out.recipes.some((x) => x.id === r.id)) out.recipes.push(structuredClone(r));
  out.version = DATA_VERSION;
  return out;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => {
      const mutInv = (fn: (inv: InventoryItem[]) => InventoryItem[]) => set((s) => ({ inventory: fn(s.inventory) }));
      const touch = (it: InventoryItem, p: Partial<InventoryItem>): InventoryItem => ({ ...it, ...p, updatedAt: now() });

      return {
        ...buildSeedData(),
        hydrated: false,
        setHydrated: (v) => set({ hydrated: v }),

        setPrefs: (p) => set((s) => ({ prefs: { ...s.prefs, ...p } })),

        // ── Inventory ──
        addItem: (it) => {
          const id = uid('inv-');
          const im = ingMap(get());
          let ingredientId = it.ingredientId;
          if (!ingredientId) {
            // create a catalog ingredient so recipes/grocery can link to it
            ingredientId = it.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || id;
            if (!im.has(ingredientId)) {
              get().addIngredient({
                id: ingredientId, name: it.name, category: it.category ?? 'other', defaultLocation: it.location ?? 'pantry',
                defaultUnit: it.unit ?? 'each', packageQty: 1, packageUnit: it.unit ?? 'each', packagePrice: it.price, priceSource: it.price != null ? 'manual' : 'estimate',
              });
            }
          }
          const ing = ingMap(get()).get(ingredientId);
          const item: InventoryItem = {
            id,
            ingredientId,
            name: it.name,
            category: it.category ?? ing?.category ?? 'other',
            location: it.location ?? ing?.defaultLocation ?? 'pantry',
            quantity: it.quantity === undefined ? null : it.quantity,
            unit: it.unit ?? ing?.defaultUnit ?? 'each',
            minQuantity: it.minQuantity ?? null,
            purchaseDate: it.purchaseDate,
            expirationDate: it.expirationDate,
            brand: it.brand,
            notes: it.notes,
            price: it.price,
            frequent: it.frequent,
            bottleSizeOz: it.bottleSizeOz,
            outOfStock: it.quantity === 0 ? true : undefined,
            updatedAt: now(),
          };
          mutInv((inv) => [...inv, item]);
          return id;
        },
        updateItem: (id, p) => mutInv((inv) => inv.map((i) => (i.id === id ? touch(i, p) : i))),
        removeItem: (id) => mutInv((inv) => inv.filter((i) => i.id !== id)),
        removeItems: (ids) => mutInv((inv) => inv.filter((i) => !ids.includes(i.id))),
        adjustQty: (id, delta) =>
          mutInv((inv) =>
            inv.map((i) => {
              if (i.id !== id) return i;
              const q = Math.max(0, Math.round(((i.quantity ?? 0) + delta) * 1000) / 1000);
              return touch(i, { quantity: q, outOfStock: q <= 0 });
            }),
          ),
        setQty: (id, qty) => mutInv((inv) => inv.map((i) => (i.id === id ? touch(i, { quantity: qty, outOfStock: qty === 0 }) : i))),
        markFinished: (id) => mutInv((inv) => inv.map((i) => (i.id === id ? touch(i, { quantity: 0, outOfStock: true }) : i))),
        setOutOfStock: (id, out) =>
          mutInv((inv) => inv.map((i) => (i.id === id ? touch(i, { outOfStock: out, quantity: out ? 0 : i.quantity === 0 ? null : i.quantity }) : i))),
        duplicateItem: (id) =>
          mutInv((inv) => {
            const src = inv.find((i) => i.id === id);
            if (!src) return inv;
            return [...inv, { ...src, id: uid('inv-'), name: src.name, updatedAt: now() }];
          }),
        bulkUpdate: (ids, p) => mutInv((inv) => inv.map((i) => (ids.includes(i.id) ? touch(i, p) : i))),
        addLocation: (name) => set((s) => ({ locations: [...s.locations, { id: uid('loc-'), name, icon: 'box' } as Location] })),
        removeLocation: (id) =>
          set((s) => ({
            locations: s.locations.filter((l) => l.id !== id || l.builtin),
            inventory: s.inventory.map((i) => (i.location === id ? { ...i, location: 'other' } : i)),
          })),

        // ── Ingredients ──
        addIngredient: (i) => set((s) => ({ ingredients: [...s.ingredients.filter((x) => x.id !== i.id), i] })),
        updateIngredient: (id, p) => set((s) => ({ ingredients: s.ingredients.map((i) => (i.id === id ? { ...i, ...p } : i)) })),
        setPrice: (rec) =>
          set((s) => ({
            prices: [...s.prices.filter((p) => !(p.ingredientId === rec.ingredientId && p.storeId === rec.storeId)), { ...rec, id: uid('pr-') }],
          })),

        // ── Recipes ──
        saveRecipe: (r) =>
          set((s) => {
            const exists = s.recipes.some((x) => x.id === r.id);
            const rr = { ...r, updatedAt: now() };
            return { recipes: exists ? s.recipes.map((x) => (x.id === r.id ? rr : x)) : [...s.recipes, rr] };
          }),
        deleteRecipe: (id) => set((s) => ({ recipes: s.recipes.filter((r) => r.id !== id), plan: { ...s.plan, entries: s.plan.entries.filter((e) => e.recipeId !== id || e.status === 'eaten') } })),
        duplicateRecipe: (id) => {
          const src = get().recipes.find((r) => r.id === id);
          const nid = uid('rec-');
          if (src) set((s) => ({ recipes: [...s.recipes, { ...structuredClone(src), id: nid, name: `${src.name} (copy)`, isSeed: false, favorite: false, createdAt: now(), updatedAt: now() }] }));
          return nid;
        },

        // ── Prepared meals ──
        savePrepared: (p) =>
          set((s) => ({ prepared: s.prepared.some((x) => x.id === p.id) ? s.prepared.map((x) => (x.id === p.id ? { ...p, updatedAt: now() } : x)) : [...s.prepared, { ...p, updatedAt: now() }] })),
        removePrepared: (id) => set((s) => ({ prepared: s.prepared.filter((p) => p.id !== id) })),
        eatPrepared: (id, servings = 1, slot = 'any') => {
          const pm = get().prepared.find((p) => p.id === id);
          if (!pm || pm.servings <= 0) return;
          const eat = Math.min(servings, pm.servings);
          set((s) => ({ prepared: s.prepared.map((p) => (p.id === id ? { ...p, servings: p.servings - eat, updatedAt: now() } : p)) }));
          get().logFood({ name: pm.name, preparedMealId: pm.id, recipeId: pm.recipeId, servings: eat, nutrition: roundN(scaleN(pm.nutrition ?? { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }, eat)), slot });
        },

        /**
         * Cook a recipe: deduct ingredients ONCE, log what is eaten now, and put the rest
         * in prepared meals. Eating those prepared servings later never deducts ingredients again.
         */
        cook: (recipeId, o) => {
          const s = get();
          const r = s.recipes.find((x) => x.id === recipeId);
          if (!r) return [];
          const im = ingMap(s);
          const deds = planDeductions(s, r, o.servings, im);
          const changes = new Map<string, number>();
          for (const d of deds) if (d.inventoryItemId && d.after != null) changes.set(d.inventoryItemId, d.after);
          for (const [k, v] of Object.entries(o.overrides ?? {})) changes.set(k, v);
          set((st) => ({
            inventory: st.inventory.map((i) => {
              if (!changes.has(i.id)) return i;
              const q = Math.max(0, changes.get(i.id)!);
              return touch(i, { quantity: q, outOfStock: q <= 0 });
            }),
          }));
          const per = recipeNutrition(r, im).perServing;
          const eatNow = Math.min(o.eatNow, o.servings);
          if (eatNow > 0) get().logFood({ name: r.name, recipeId: r.id, servings: eatNow, nutrition: roundN(scaleN(per, eatNow)), slot: slotFor(r.category) });
          const rest = o.servings - eatNow;
          let preparedId: string | undefined;
          if (rest > 0 && o.storeRest) {
            const prepDate = o.preparedDate ?? todayISO();
            preparedId = uid('prep-');
            const days = o.fridgeDays ?? (o.location === 'freezer' ? r.freezerDays : r.fridgeDays);
            get().savePrepared({
              id: preparedId, recipeId: r.id, name: r.name, servings: rest, location: o.location, preparedDate: prepDate,
              expirationDate: days ? addDays(prepDate, days) : undefined, nutrition: roundN(per), reheating: r.reheating,
              notes: r.storage, updatedAt: now(),
            });
          }
          if (o.planEntryId) {
            get().updateEntry(o.planEntryId, eatNow > 0 ? { status: 'eaten' } : { status: 'prepared', preparedMealId: preparedId });
          }
          return deds;
        },

        // ── Plan ──
        addEntry: (e) =>
          set((s) => {
            const order = e.order ?? Math.max(-1, ...s.plan.entries.filter((x) => x.date === e.date).map((x) => x.order)) + 1;
            return { plan: { ...s.plan, entries: [...s.plan.entries, { ...e, id: uid('pe-'), order }] } };
          }),
        updateEntry: (id, p) => set((s) => ({ plan: { ...s.plan, entries: s.plan.entries.map((e) => (e.id === id ? { ...e, ...p } : e)) } })),
        removeEntry: (id) => set((s) => ({ plan: { ...s.plan, entries: s.plan.entries.filter((e) => e.id !== id) } })),
        moveEntry: (id, date, beforeId) =>
          set((s) => {
            const entries = s.plan.entries.map((e) => (e.id === id ? { ...e, date } : e));
            const day = entries.filter((e) => e.date === date && e.id !== id).sort((a, b) => a.order - b.order);
            const moving = entries.find((e) => e.id === id)!;
            const idx = beforeId ? day.findIndex((e) => e.id === beforeId) : -1;
            if (idx >= 0) day.splice(idx, 0, moving);
            else day.push(moving);
            const orders = new Map(day.map((e, i) => [e.id, i]));
            return { plan: { ...s.plan, entries: entries.map((e) => (orders.has(e.id) ? { ...e, order: orders.get(e.id)! } : e)) } };
          }),
        copyWeek: (from, to) => {
          const s = get();
          const src = s.plan.entries.filter((e) => e.date >= from && e.date < addDays(from, 7) && e.recipeId);
          const copies = src.map((e) => {
            const offset = Math.round((new Date(e.date).getTime() - new Date(from).getTime()) / 86400000);
            return { ...e, id: uid('pe-'), date: addDays(to, offset), status: 'planned' as const, preparedMealId: undefined };
          });
          set({ plan: { ...s.plan, entries: [...s.plan.entries, ...copies] } });
          return copies.length;
        },
        generateWeek: (ws, opts = {}) => {
          const s = get();
          const days = opts.days ?? 7;
          let entries = s.plan.entries;
          if (opts.replace) entries = entries.filter((e) => !(e.date >= ws && e.date < addDays(ws, days) && e.status === 'planned'));
          const used = new Map<string, number>();
          const pick = (cat: Recipe['category'], date: string, workout: boolean) => {
            const sug = suggestFor(s, undefined, 40, (r) => r.category === cat)
              .filter((x) => x.kind === 'recipe')
              .map((x) => {
                let sc = x.score - (used.get(x.recipe!.id) ?? 0) * 30;
                if (workout && x.recipe!.tags.includes('post-workout')) sc += 10;
                // gentle randomness so weeks vary
                sc += Math.random() * 12;
                return { r: x.recipe!, sc };
              })
              .sort((a, b) => b.sc - a.sc);
            const r = sug[0]?.r;
            if (r) used.set(r.id, (used.get(r.id) ?? 0) + 1);
            return r;
          };
          const added: MealPlanEntry[] = [];
          // use available prepared meals first (e.g. the 4 chicken burgers)
          const preparedQueue = s.prepared.filter((p) => p.servings > 0).flatMap((p) => Array.from({ length: Math.min(p.servings, days) }, () => p));
          for (let i = 0; i < days; i++) {
            const date = addDays(ws, i);
            const has = (slot: MealSlot) => entries.some((e) => e.date === date && e.slot === slot);
            const workout = s.plan.workoutDays.includes(date);
            let order = entries.filter((e) => e.date === date).length;
            for (const slot of ['breakfast', 'lunch', 'dinner'] as const) {
              if (has(slot)) continue;
              if (slot !== 'breakfast' && preparedQueue.length && (i % 2 === 1 || slot === 'dinner') && added.filter((a) => a.preparedMealId && a.date === date).length === 0) {
                const p = preparedQueue.shift()!;
                added.push({ id: uid('pe-'), date, slot, preparedMealId: p.id, servings: 1, status: 'planned', order: order++ });
                continue;
              }
              const r = pick(slot, date, workout);
              if (r) added.push({ id: uid('pe-'), date, slot, recipeId: r.id, servings: 1, status: 'planned', order: order++ });
            }
            if (!has('snack')) {
              const r = pick('snack', date, workout);
              if (r) added.push({ id: uid('pe-'), date, slot: 'snack', recipeId: r.id, servings: 1, status: 'planned', order: order++, note: 'Planned evening snack' });
            }
          }
          set({ plan: { ...s.plan, entries: [...entries, ...added] } });
        },
        clearWeek: (ws) => set((s) => ({ plan: { ...s.plan, entries: s.plan.entries.filter((e) => !(e.date >= ws && e.date < addDays(ws, 7) && e.status === 'planned')) } })),
        toggleWorkoutDay: (date) =>
          set((s) => ({ plan: { ...s.plan, workoutDays: s.plan.workoutDays.includes(date) ? s.plan.workoutDays.filter((d) => d !== date) : [...s.plan.workoutDays, date] } })),
        markEntryEaten: (id) => {
          const s = get();
          const e = s.plan.entries.find((x) => x.id === id);
          if (!e) return;
          if (e.preparedMealId) {
            get().eatPrepared(e.preparedMealId, e.servings, e.slot);
          } else if (e.recipeId) {
            const r = s.recipes.find((x) => x.id === e.recipeId);
            if (r) {
              const per = recipeNutrition(r, ingMap(s)).perServing;
              get().logFood({ name: r.name, recipeId: r.id, servings: e.servings, nutrition: roundN(scaleN(per, e.servings)), slot: e.slot });
            }
          } else if (e.customName) {
            get().logFood({ name: e.customName, servings: e.servings, nutrition: { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }, slot: e.slot });
          }
          get().updateEntry(id, { status: 'eaten' });
        },

        // ── Logs ──
        logFood: (f) => set((s) => ({ foodLogs: [...s.foodLogs, { ...f, id: uid('fl-'), date: f.date ?? todayISO(), time: nowTime() }] })),
        removeFoodLog: (id) => set((s) => ({ foodLogs: s.foodLogs.filter((f) => f.id !== id) })),
        logWater: (amountOz, kind, deductFromStock) => {
          const s = get();
          let stockItemId: string | undefined;
          if (kind === 'bottle' && (deductFromStock ?? s.prefs.deductBottleOnLog)) {
            const stock = s.inventory
              .filter((i) => i.category === 'water' && i.unit === 'bottle' && (i.quantity ?? 0) > 0)
              .sort((a, b) => Math.abs((a.bottleSizeOz ?? 16.9) - amountOz) - Math.abs((b.bottleSizeOz ?? 16.9) - amountOz))[0];
            if (stock) {
              stockItemId = stock.id;
              get().adjustQty(stock.id, -1);
            }
          }
          set((st) => ({ waterLogs: [...st.waterLogs, { id: uid('wl-'), date: todayISO(), time: nowTime(), amountOz, kind, stockItemId }] }));
        },
        removeWaterLog: (id) => {
          const log = get().waterLogs.find((w) => w.id === id);
          if (log?.stockItemId && get().inventory.some((i) => i.id === log.stockItemId)) get().adjustQty(log.stockItemId, 1);
          set((s) => ({ waterLogs: s.waterLogs.filter((w) => w.id !== id) }));
        },
        addWeight: (w) => {
          set((s) => ({ weightLogs: [...s.weightLogs.filter((x) => x.date !== w.date), { ...w, id: uid('wt-') }].sort((a, b) => a.date.localeCompare(b.date)) }));
          const latest = get().weightLogs.at(-1);
          if (latest) get().setPrefs({ weightLb: latest.weightLb });
        },
        removeWeight: (id) => set((s) => ({ weightLogs: s.weightLogs.filter((w) => w.id !== id) })),
        addWorkout: (w) => set((s) => ({ workoutLogs: [...s.workoutLogs, { ...w, id: uid('wo-') }] })),
        removeWorkout: (id) => set((s) => ({ workoutLogs: s.workoutLogs.filter((w) => w.id !== id) })),
        addPhotoMeta: (id, date, note) => set((s) => ({ photos: [...s.photos, { id, date, note }] })),
        removePhoto: (id) => {
          idbDel(`photo:${id}`).catch(() => {});
          set((s) => ({ photos: s.photos.filter((p) => p.id !== id) }));
        },

        // ── Stores ──
        addStore: (name) => set((s) => ({ stores: [...s.stores, { id: uid('store-'), name, color: '#4b7f63' }] })),
        updateStore: (id, p) => set((s) => ({ stores: s.stores.map((x) => (x.id === id ? { ...x, ...p } : x)) })),
        removeStore: (id) => set((s) => ({ stores: s.stores.filter((x) => x.id !== id) })),

        // ── Grocery ──
        setDraftItems: (items) => set((s) => ({ groceryDraft: { ...s.groceryDraft, items } })),
        updateDraftItem: (id, p) => set((s) => ({ groceryDraft: { ...s.groceryDraft, items: s.groceryDraft.items.map((i) => (i.id === id ? { ...i, ...p } : i)) } })),
        saveTrip: (t) => set((s) => ({ trips: s.trips.some((x) => x.id === t.id) ? s.trips.map((x) => (x.id === t.id ? t : x)) : [...s.trips, t] })),
        removeTrip: (id) => set((s) => ({ trips: s.trips.filter((t) => t.id !== id) })),
        completeTrip: (id, actualTotal, purchases) => {
          const t = get().trips.find((x) => x.id === id);
          if (!t) return;
          get().restockItems(purchases, t.storeId);
          get().saveTrip({ ...t, status: 'completed', actualTotal, completedAt: now(), list: { ...t.list, items: t.list.items.map((i) => purchases.find((p) => p.id === i.id) ?? i) } });
        },
        /** Add purchased quantities to inventory (merging into matching entries, never double-adding). */
        restockItems: (purchases, storeId) => {
          const today = todayISO();
          for (const p of purchases) {
            const qty = p.purchasedQty ?? p.quantity;
            if (!qty || qty <= 0) continue;
            const s = get();
            const im = ingMap(s);
            const ing = p.ingredientId ? im.get(p.ingredientId) : undefined;
            const loc = p.location ?? ing?.defaultLocation ?? 'pantry';
            const candidates = s.inventory.filter((i) => i.ingredientId === p.ingredientId);
            const target =
              candidates.find((i) => i.location === loc && (i.quantity === null || convert(1, p.unit, i.unit, ing) != null)) ??
              candidates.find((i) => convert(1, p.unit, i.unit, ing) != null);
            const perUnitPrice = p.actualPrice ?? p.estPrice;
            if (target) {
              const nq = target.quantity === null && target.unit !== p.unit && convert(1, p.unit, target.unit, ing) == null ? null : addToItem(target, qty, p.unit, ing);
              get().updateItem(target.id, {
                quantity: nq ?? qty,
                unit: nq == null ? p.unit : target.unit,
                outOfStock: false,
                purchaseDate: today,
                location: loc,
                price: perUnitPrice || target.price,
              });
            } else {
              get().addItem({
                ingredientId: p.ingredientId, name: ing?.name ?? p.name, category: p.category, location: loc, quantity: qty, unit: p.unit,
                purchaseDate: today, price: perUnitPrice, bottleSizeOz: p.category === 'water' && p.unit === 'bottle' ? get().prefs.defaultBottleOz : undefined,
              });
            }
            if (p.actualPrice != null && p.ingredientId && storeId) {
              get().setPrice({ ingredientId: p.ingredientId, storeId, price: p.actualPrice, packageQty: qty, packageUnit: p.unit, source: 'verified', checkedAt: now() });
            }
          }
        },

        // ── Data ──
        importData: (d) => set({ ...migrate(d) }),
        resetData: () => set({ ...buildSeedData() }),
        exportData: () => dataOnly(get()),
      };
    },
    {
      name: STORAGE_KEY,
      version: DATA_VERSION,
      storage: createJSONStorage(() => idbStorage),
      partialize: (s) => dataOnly(s as AppState),
      merge: (persisted, current) => ({ ...current, ...(persisted ? migrate(persisted as Partial<AppData>) : {}) }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);

export function slotFor(cat: Recipe['category']): MealSlot {
  return cat === 'snack' ? 'snack' : cat;
}

// Ask the browser to keep our storage (reduces eviction risk on iOS/Safari).
if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
  navigator.storage.persist().catch(() => {});
}

export type { Nutrients, Unit, PriceSource };
