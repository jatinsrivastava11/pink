import { useState, useMemo } from 'react';
import { create } from 'zustand';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { ingMap, planDeductions, recipeNutrition, suggestFor, LABEL_TEXT, type Mood, buildGroceryItems, listTotal, budgetSuggestions, applySubstitute } from '../lib/engine';
import { fmtQU, money, ALL_UNITS, unitLabel } from '../lib/units';
import { addDays, todayISO, uid } from '../lib/dates';
import { estimateMaintenance, suggestTarget, roundN } from '../lib/nutrition';
import type { Cuisine, GroceryCategory, GroceryItem, InventoryItem, ShoppingTrip, Unit } from '../types';
import { Badge, Button, Chips, Field, Input, Modal, Select, Stepper, Textarea, Toggle, toast } from './ui';
import { Check, ChefHat, Flame, HeartHandshake, ShoppingBag, Sparkles, Utensils, AlertTriangle, ArrowRight } from 'lucide-react';

// Global modal triggers so any page/card can open shared flows
interface ModalBus {
  cookRecipeId: string | null;
  cookPlanEntryId?: string;
  cookDefaultServings?: number;
  openCook: (recipeId: string, opts?: { servings?: number; planEntryId?: string }) => void;
  closeCook: () => void;

  tripOpen: boolean;
  tripInitialSelections?: { recipeId: string; servings: number }[];
  openTrip: (sel?: { recipeId: string; servings: number }[]) => void;
  closeTrip: () => void;

  supportOpen: boolean;
  openSupport: () => void;
  closeSupport: () => void;

  addInvOpen: boolean;
  editInvItem: InventoryItem | null;
  openAddInv: (item?: InventoryItem | null) => void;
  closeAddInv: () => void;

  weightOpen: boolean;
  openWeight: () => void;
  closeWeight: () => void;
}

export const useModals = create<ModalBus>((set) => ({
  cookRecipeId: null,
  openCook: (recipeId, o) => set({ cookRecipeId: recipeId, cookDefaultServings: o?.servings, cookPlanEntryId: o?.planEntryId }),
  closeCook: () => set({ cookRecipeId: null, cookPlanEntryId: undefined, cookDefaultServings: undefined }),

  tripOpen: false,
  openTrip: (sel) => set({ tripOpen: true, tripInitialSelections: sel }),
  closeTrip: () => set({ tripOpen: false, tripInitialSelections: undefined }),

  supportOpen: false,
  openSupport: () => set({ supportOpen: true }),
  closeSupport: () => set({ supportOpen: false }),

  addInvOpen: false,
  editInvItem: null,
  openAddInv: (item = null) => set({ addInvOpen: true, editInvItem: item }),
  closeAddInv: () => set({ addInvOpen: false, editInvItem: null }),

  weightOpen: false,
  openWeight: () => set({ weightOpen: true }),
  closeWeight: () => set({ weightOpen: false }),
}));

// ───────────────────────── 1. Onboarding ─────────────────────────
export function OnboardingModal() {
  const prefs = useStore((s) => s.prefs);
  const stores = useStore((s) => s.stores);
  const setPrefs = useStore((s) => s.setPrefs);
  const addWeight = useStore((s) => s.addWeight);

  const [step, setStep] = useState(0);
  const [age, setAge] = useState<string>(prefs.age ? String(prefs.age) : '19');
  const [confirmAge, setConfirmAge] = useState(true);
  const [feet, setFeet] = useState(Math.floor(prefs.heightIn / 12));
  const [inches, setInches] = useState(prefs.heightIn % 12);
  const [weight, setWeight] = useState(prefs.weightLb);
  const [goalWeight, setGoalWeight] = useState(prefs.goalWeightLb);
  const [activity, setActivity] = useState(prefs.activity);
  const [protein, setProtein] = useState(prefs.proteinTarget);
  const [useCalTarget, setUseCalTarget] = useState(false);
  const [customCal, setCustomCal] = useState<string>('');
  const [budget, setBudget] = useState(prefs.defaultBudget);
  const [prepTimes, setPrepTimes] = useState(prefs.mealPrepPerWeek);
  const [cuisines, setCuisines] = useState<Cuisine[]>(prefs.cuisines);

  if (prefs.onboarded) return null;

  const heightIn = feet * 12 + inches;
  const ageNum = parseInt(age, 10);
  const validAge = !Number.isNaN(ageNum) && ageNum >= 16 && ageNum <= 90 ? ageNum : null;
  const maint = estimateMaintenance({ age: validAge, sex: prefs.sex, heightIn, weightLb: weight, activity });
  const suggestedCal = suggestTarget(maint);

  const finish = (skip = false) => {
    if (skip) {
      setPrefs({ onboarded: true });
      toast('Welcome! Your kitchen inventory and 4 prepped burgers are ready.');
      return;
    }
    const cal = useCalTarget && validAge && confirmAge ? (customCal ? Number(customCal) : suggestedCal) : null;
    setPrefs({
      age: validAge,
      ageConfirmed: !!(validAge && confirmAge),
      heightIn,
      weightLb: weight,
      goalWeightLb: goalWeight,
      activity,
      proteinTarget: protein,
      calorieTarget: cal,
      defaultBudget: budget,
      mealPrepPerWeek: prepTimes,
      cuisines,
      onboarded: true,
    });
    addWeight({ date: todayISO(), weightLb: weight, note: 'Initial check-in' });
    toast('Profile saved — your full kitchen inventory is already loaded!');
  };

  return (
    <Modal
      open={!prefs.onboarded}
      onClose={() => finish(true)}
      wide
      title={
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-brand-600" />
          <span>Welcome to Pink Kitchen</span>
        </div>
      }
      footer={
        <div className="flex items-center justify-between w-full">
          <Button variant="ghost" onClick={() => finish(true)}>Skip for now</Button>
          <div className="flex gap-2">
            {step > 0 && <Button variant="secondary" onClick={() => setStep(step - 1)}>Back</Button>}
            {step < 2 ? (
              <Button variant="primary" onClick={() => setStep(step + 1)}>Continue <ArrowRight size={15} /></Button>
            ) : (
              <Button variant="primary" onClick={() => finish(false)}><Check size={16} /> Finish setup</Button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-brand-500' : 'bg-line-2'}`} />
          ))}
        </div>

        {step === 0 && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-brand-50 border border-brand-100 p-3.5 text-xs text-brand-800">
              <strong>Your kitchen is already stocked.</strong> All your meats, dairy, vegetables, Indian spices, sauces, water bottles, and your <strong>4 prepped ground chicken burgers</strong> are preloaded. You can verify exact quantities anytime.
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Exact age (18–19)" hint="Required before setting any calorie target">
                <Input type="number" min={16} max={90} value={age} onChange={(e) => setAge(e.target.value)} />
              </Field>
              <div className="flex items-end pb-1">
                <Toggle checked={confirmAge} onChange={setConfirmAge} label={<span className="text-xs">Confirm exact age</span>} />
              </div>
              <Field label="Height (ft)">
                <Input type="number" min={4} max={7} value={feet} onChange={(e) => setFeet(Number(e.target.value))} />
              </Field>
              <Field label="Height (in)">
                <Input type="number" min={0} max={11} value={inches} onChange={(e) => setInches(Number(e.target.value))} />
              </Field>
              <Field label="Current weight (lbs)" hint="6'1&quot; · 176 lbs is already in the healthy BMI range (~23.2)">
                <Input type="number" step="0.5" value={weight} onChange={(e) => setWeight(Number(e.target.value))} />
              </Field>
              <Field label="Aspirational weight (lbs)" hint="Flexible guidepost — recomposition comes first">
                <Input type="number" step="0.5" value={goalWeight} onChange={(e) => setGoalWeight(Number(e.target.value))} />
              </Field>
            </div>
            <Field label="Activity level">
              <Select value={activity} onChange={(e) => setActivity(e.target.value as any)}>
                <option value="sedentary">Sedentary (desk job, minimal walking)</option>
                <option value="light">Lightly active (walking + optional 3×/wk lifting)</option>
                <option value="moderate">Moderately active (regular training + daily steps)</option>
                <option value="active">Very active</option>
              </Select>
            </Field>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <Field label="Daily protein planning target (g)" hint="Provisional range: 120–140 g/day to support muscle retention & evening satiety">
              <Input type="number" value={protein} onChange={(e) => setProtein(Number(e.target.value))} />
            </Field>
            <div className="rounded-2xl border border-line p-3.5 space-y-2.5 bg-canvas/50">
              <Toggle
                checked={useCalTarget}
                onChange={setUseCalTarget}
                label={<span className="font-medium text-sm">Set a gentle, sustainable daily calorie estimate</span>}
              />
              <p className="text-xs text-ink-3">
                No crash diets or extreme deficits. With your stats ({feet}&apos;{inches}&quot;, {weight} lbs, {validAge ?? '—'} yrs), estimated maintenance is ~<strong>{maint ?? '—'} kcal/day</strong>. A mild ~15% recomposition target is ~<strong>{suggestedCal ?? '—'} kcal/day</strong>. You can leave this off and focus on protein + satisfying meals first.
              </p>
              {useCalTarget && (
                <Field label="Custom calorie target (optional)" hint={`Leave blank to use ${suggestedCal ?? 2200} kcal (all values are estimates, not medical prescriptions)`}>
                  <Input type="number" placeholder={String(suggestedCal ?? 2200)} value={customCal} onChange={(e) => setCustomCal(e.target.value)} />
                </Field>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Default grocery trip budget ($)" hint="We still ask before every trip">
                <Input type="number" value={budget} onChange={(e) => setBudget(Number(e.target.value))} />
              </Field>
              <Field label="Meal prep sessions / week">
                <Select value={String(prepTimes)} onChange={(e) => setPrepTimes(Number(e.target.value))}>
                  <option value="1">1× per week</option>
                  <option value="2">2× per week</option>
                  <option value="3">3× per week</option>
                </Select>
              </Field>
            </div>
            <Field label="Preferred cuisines">
              <div className="flex flex-wrap gap-1.5">
                {(['Indian', 'Mexican', 'Asian', 'Western', 'Italian'] as Cuisine[]).map((c) => {
                  const on = cuisines.includes(c);
                  return (
                    <button
                      type="button"
                      key={c}
                      onClick={() => setCuisines(on ? cuisines.filter((x) => x !== c) : [...cuisines, c])}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border ${on ? 'bg-brand-600 text-white border-brand-600' : 'bg-white border-line text-ink-2'}`}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            </Field>
            <div className="text-xs text-ink-3 rounded-xl bg-line-2 p-3">
              Stores configured: <strong>{stores.map((s) => s.name).join(', ')}</strong>. You can add or edit stores anytime.
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ───────────────────────── 2. Cook / Prep Modal ─────────────────────────
export function CookModal() {
  const { cookRecipeId, cookDefaultServings, cookPlanEntryId, closeCook } = useModals();
  const state = useStore();
  const recipe = state.recipes.find((r) => r.id === cookRecipeId);

  const [servings, setServings] = useState<number>(cookDefaultServings ?? recipe?.servings ?? 2);
  const [eatNow, setEatNow] = useState<number>(1);
  const [storeRest, setStoreRest] = useState<boolean>(true);
  const [location, setLocation] = useState<string>('fridge');
  const [prepDate, setPrepDate] = useState<string>(todayISO());
  const [overrides, setOverrides] = useState<Record<string, number>>({});

  // sync when recipe changes
  useMemo(() => {
    if (recipe) {
      const s = cookDefaultServings ?? recipe.servings;
      setServings(s);
      setEatNow(Math.min(1, s));
      setStoreRest(s > 1);
      setOverrides({});
    }
  }, [recipe?.id, cookDefaultServings]);

  if (!recipe) return null;

  const im = ingMap(state);
  const deds = planDeductions(state, recipe, servings, im);
  const nu = roundN(recipeNutrition(recipe, im).perServing);
  const rest = Math.max(0, servings - eatNow);

  const submit = () => {
    state.cook(recipe.id, {
      servings,
      eatNow,
      storeRest,
      location,
      preparedDate: prepDate,
      overrides,
      planEntryId: cookPlanEntryId,
    });
    const msg =
      eatNow > 0 && rest > 0 && storeRest
        ? `Logged ${eatNow} serving & stored ${rest} in ${location}`
        : eatNow > 0
          ? `Cooked & logged ${eatNow} serving of ${recipe.name}`
          : `Prepped ${rest} servings of ${recipe.name}`;
    toast(msg);
    closeCook();
  };

  return (
    <Modal
      open={!!recipe}
      onClose={closeCook}
      wide
      title={
        <div className="flex items-center gap-2">
          <ChefHat size={18} className="text-brand-600" />
          <span>Cook or Meal-Prep: {recipe.name}</span>
        </div>
      }
      footer={
        <>
          <Button variant="secondary" onClick={closeCook}>Cancel</Button>
          <Button variant="primary" onClick={submit}><Check size={16} /> Confirm & update stock</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-canvas p-3.5 rounded-2xl border border-line">
          <div>
            <div className="text-xs text-ink-3 mb-1">Total servings cooked</div>
            <Stepper
              value={`${servings} srv`}
              onDec={() => { const n = Math.max(1, servings - 1); setServings(n); if (eatNow > n) setEatNow(n); }}
              onInc={() => setServings(servings + 1)}
            />
          </div>
          <div>
            <div className="text-xs text-ink-3 mb-1">Eat right now</div>
            <Stepper
              value={`${eatNow} srv`}
              onDec={() => setEatNow(Math.max(0, eatNow - 1))}
              onInc={() => setEatNow(Math.min(servings, eatNow + 1))}
            />
          </div>
          <div>
            <div className="text-xs text-ink-3 mb-1">Per serving (est.)</div>
            <div className="text-sm font-semibold">{nu.kcal} kcal · {nu.protein}g P</div>
            <div className="text-[11px] text-ink-3">{nu.carbs}g C · {nu.fat}g F · {nu.fiber}g fiber</div>
          </div>
        </div>

        {rest > 0 && (
          <div className="rounded-2xl border border-brand-200 bg-brand-50/60 p-3.5 space-y-3">
            <Toggle
              checked={storeRest}
              onChange={setStoreRest}
              label={<span className="text-sm font-medium">Save remaining {rest} {rest === 1 ? 'serving' : 'servings'} to Prepared Meals</span>}
            />
            {storeRest && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <Field label="Storage location">
                  <Select value={location} onChange={(e) => setLocation(e.target.value)}>
                    <option value="fridge">Fridge ({recipe.fridgeDays ?? 3} days conservative)</option>
                    {(recipe.freezerDays ?? 0) > 0 && <option value="freezer">Freezer ({recipe.freezerDays} days)</option>}
                  </Select>
                </Field>
                <Field label="Preparation date">
                  <Input type="date" value={prepDate} onChange={(e) => setPrepDate(e.target.value)} />
                </Field>
              </div>
            )}
            <p className="text-[11px] text-ink-3">
              Ingredients are deducted <strong>now</strong> when you cook. Eating those prepared portions later will only reduce the prepared-meal count — never double-deducting raw ingredients.
            </p>
          </div>
        )}

        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-ink-3 mb-2">Ingredient deductions (editable)</div>
          <div className="divide-y divide-line border border-line rounded-2xl overflow-hidden bg-white">
            {deds.map((d, idx) => {
              const afterVal = d.inventoryItemId && overrides[d.inventoryItemId] !== undefined ? overrides[d.inventoryItemId] : d.after;
              return (
                <div key={idx} className="px-3.5 py-2.5 flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{d.name}</div>
                    {d.note ? (
                      <div className="text-xs text-amber-700">{d.note}</div>
                    ) : (
                      <div className="text-xs text-ink-3">
                        Stock: {fmtQU(d.before, d.unit)} → <strong>{fmtQU(afterVal, d.unit)}</strong> (−{fmtQU(d.amount, d.unit)})
                      </div>
                    )}
                  </div>
                  {d.inventoryItemId && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-xs text-ink-3">New qty:</span>
                      <Input
                        type="number"
                        step="any"
                        className="!w-20 !py-1 !px-2 text-right"
                        placeholder={d.after == null ? '—' : String(d.after)}
                        value={afterVal == null ? '' : afterVal}
                        onChange={(e) => {
                          const v = e.target.value === '' ? 0 : Number(e.target.value);
                          setOverrides({ ...overrides, [d.inventoryItemId!]: v });
                        }}
                      />
                      <span className="text-xs text-ink-3">{unitLabel(d.unit)}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ───────────────────────── 3. "What do I need right now?" ─────────────────────────
const MOODS: { id: Mood; label: string; sub: string; guidance: string }[] = [
  { id: 'physically-hungry', label: "I'm physically hungry", sub: 'Real stomach hunger', guidance: 'Prioritize protein + fiber + volume so you feel genuinely satisfied, not restricted.' },
  { id: 'stressed', label: "I'm stressed", sub: 'Need zero-friction comfort', guidance: 'When stressed, cooking feels impossible. Grab an already-prepared meal or a 5-minute assembly option — zero guilt.' },
  { id: 'craving', label: "I'm craving something", sub: 'Want bold flavor', guidance: 'Hit the flavor head-on (spiced tikka, quesadilla, burger, chaat) in a satisfying protein-forward portion.' },
  { id: 'no-cook', label: "I don't want to cook", sub: '0–5 min assembly', guidance: 'Here are ready-to-eat prepped meals and no-cook bowls using what you already have.' },
  { id: 'sweet', label: 'I want something sweet', sub: 'Evening sweet tooth', guidance: 'Greek yogurt + fruit + honey or granola hits sweet + creamy while adding 15–20 g protein.' },
  { id: 'crunchy', label: 'I want something crunchy', sub: 'Salty / crispy texture', guidance: 'Pair crunch (granola bar, roasted chana, potato wedges, or a measured bowl of chips) with a high-protein yogurt dip.' },
  { id: 'filling-dinner', label: 'I want a filling dinner', sub: 'Strong evening hunger', guidance: 'Substantial, high-volume dinners so you aren’t raiding the kitchen at 11 pm.' },
  { id: 'bored', label: "I'm bored", sub: 'Restless / procrastinating', guidance: 'Take a 5-minute walk or change rooms first; if you still want food, pick a structured protein snack on a plate.' },
];

export function SupportModal() {
  const { supportOpen, closeSupport, openCook } = useModals();
  const state = useStore();
  const [mood, setMood] = useState<Mood>('stressed');
  const active = MOODS.find((m) => m.id === mood)!;
  const suggestions = useMemo(() => suggestFor(state, mood, 6), [state, mood]);

  return (
    <Modal
      open={supportOpen}
      onClose={closeSupport}
      wide
      title={
        <div className="flex items-center gap-2">
          <HeartHandshake size={18} className="text-brand-600" />
          <span>What do I need right now?</span>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {MOODS.map((m) => (
            <button
              key={m.id}
              onClick={() => setMood(m.id)}
              className={`text-left rounded-2xl p-3 border transition ${mood === m.id ? 'bg-brand-600 text-white border-brand-600' : 'bg-white border-line hover:border-ink-3'}`}
            >
              <div className="font-medium text-xs">{m.label}</div>
              <div className={`text-[11px] mt-0.5 ${mood === m.id ? 'text-white/80' : 'text-ink-3'}`}>{m.sub}</div>
            </button>
          ))}
        </div>

        <div className="rounded-2xl bg-brand-50 border border-brand-100 p-3.5 text-xs text-brand-800">
          {active.guidance}
        </div>

        <div className="space-y-2.5">
          {suggestions.map((s, i) => {
            if (s.kind === 'prepared' && s.prepared) {
              const p = s.prepared;
              return (
                <div key={p.id} className="rounded-2xl border border-brand-200 bg-brand-50/40 p-3.5 flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge tone="green">Ready now · {p.servings} left</Badge>
                      <span className="font-semibold text-sm">{p.name}</span>
                    </div>
                    <div className="text-xs text-ink-3 mt-1">
                      {p.nutrition ? `~${p.nutrition.kcal} kcal · ${p.nutrition.protein}g protein · ` : ''}{p.reheating ?? 'Reheat and eat'}
                    </div>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      state.eatPrepared(p.id, 1, 'any');
                      toast(`Enjoy! 1 ${p.name} logged (${p.servings - 1} remaining).`);
                      closeSupport();
                    }}
                  >
                    Eat 1 now
                  </Button>
                </div>
              );
            }
            if (s.recipe) {
              const r = s.recipe;
              const n = roundN(s.nutrition ?? { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
              return (
                <div key={r.id + i} className="rounded-2xl border border-line bg-white p-3.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{r.emoji} {r.name}</span>
                      {s.availability && (
                        <Badge tone={s.availability.label === 'can-make' ? 'green' : s.availability.label === 'substitutions' ? 'blue' : 'amber'}>
                          {LABEL_TEXT[s.availability.label]}
                        </Badge>
                      )}
                      <span className="text-xs text-ink-3">{r.prepMin + r.cookMin} min</span>
                    </div>
                    <div className="text-xs text-ink-3 mt-1">
                      ~{n.kcal} kcal · <strong>{n.protein}g protein</strong> · {n.fiber}g fiber
                    </div>
                  </div>
                  <Button
                    variant="soft"
                    size="sm"
                    onClick={() => {
                      closeSupport();
                      openCook(r.id, { servings: 1 });
                    }}
                  >
                    Make this
                  </Button>
                </div>
              );
            }
            return null;
          })}
        </div>
      </div>
    </Modal>
  );
}

// ───────────────────────── 4. Plan Grocery Trip Wizard ─────────────────────────
export function PlanTripModal() {
  const { tripOpen, closeTrip, tripInitialSelections } = useModals();
  const state = useStore();
  const nav = useNavigate();

  const [step, setStep] = useState<'setup' | 'meals' | 'review'>('setup');
  const [storeId, setStoreId] = useState(state.stores[0]?.id ?? 'walmart');
  const [budgetAmt, setBudgetAmt] = useState<number>(state.prefs.defaultBudget || 60);
  const [strict, setStrict] = useState<boolean>(true);
  const [days, setDays] = useState<number>(5);
  const [customDays, setCustomDays] = useState<string>('');
  const [includeNonFood, setIncludeNonFood] = useState<boolean>(false);
  const [includeLowStock, setIncludeLowStock] = useState<boolean>(true);
  const [priority, setPriority] = useState<'cost' | 'convenience'>('cost');
  const [selections, setSelections] = useState<{ recipeId: string; servings: number }[]>([]);
  const [items, setItems] = useState<GroceryItem[]>([]);

  // Initialize selections from meal plan or passed selections when opened
  useMemo(() => {
    if (!tripOpen) return;
    setStep('setup');
    const effDays = customDays ? Number(customDays) : days;
    if (tripInitialSelections?.length) {
      setSelections(tripInitialSelections);
      return;
    }
    const today = todayISO();
    const end = addDays(today, effDays);
    const planned = state.plan.entries.filter((e) => e.date >= today && e.date < end && e.status === 'planned' && e.recipeId);
    if (planned.length) {
      const map = new Map<string, number>();
      for (const e of planned) map.set(e.recipeId!, (map.get(e.recipeId!) ?? 0) + e.servings);
      setSelections([...map.entries()].map(([recipeId, servings]) => ({ recipeId, servings })));
    } else {
      // default sensible picks using frequent recipes
      const freq = state.recipes.filter((r) => r.frequent).slice(0, 5);
      setSelections(freq.map((r) => ({ recipeId: r.id, servings: r.servings })));
    }
  }, [tripOpen]);

  if (!tripOpen) return null;

  const effDays = customDays ? Math.max(1, Number(customDays)) : days;
  const generate = () => {
    const built = buildGroceryItems(state, selections, { storeId, includeLowStock, includeNonFood });
    setItems(built);
    setStep('review');
  };

  const total = listTotal(items);
  const over = total - budgetAmt;
  const suggestions = budgetSuggestions(state, items, budgetAmt, storeId);

  const approveAndShop = () => {
    const trip: ShoppingTrip = {
      id: uid('trip-'),
      storeId,
      budget: { amount: budgetAmt, strict },
      days: effDays,
      includeNonFood,
      priority,
      status: 'shopping',
      recipeSelections: selections,
      list: { id: uid('gl-'), name: `${state.stores.find((s) => s.id === storeId)?.name ?? 'Grocery'} trip`, createdAt: new Date().toISOString(), items },
      estimatedTotal: total,
      createdAt: new Date().toISOString(),
    };
    state.saveTrip(trip);
    state.setDraftItems(items);
    closeTrip();
    nav(`/groceries?trip=${trip.id}`);
    toast('Shopping mode ready! Check off items as you walk the aisles.');
  };

  return (
    <Modal
      open={tripOpen}
      onClose={closeTrip}
      wide
      title={
        <div className="flex items-center gap-2">
          <ShoppingBag size={18} className="text-brand-600" />
          <span>Plan a Grocery Trip</span>
        </div>
      }
      footer={
        <div className="flex justify-between w-full">
          {step !== 'setup' ? (
            <Button variant="secondary" onClick={() => setStep(step === 'review' ? 'meals' : 'setup')}>Back</Button>
          ) : <div />}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={closeTrip}>Cancel</Button>
            {step === 'setup' && <Button variant="primary" onClick={() => setStep('meals')}>Next: Confirm meals <ArrowRight size={15} /></Button>}
            {step === 'meals' && <Button variant="primary" onClick={generate}>Calculate grocery list <ArrowRight size={15} /></Button>}
            {step === 'review' && <Button variant="primary" onClick={approveAndShop}><Check size={16} /> Approve & open Shopping Mode</Button>}
          </div>
        </div>
      }
    >
      {step === 'setup' && (
        <div className="space-y-4">
          <p className="text-xs text-ink-3">We ask before every trip so your list fits today&apos;s store and budget.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="1. Which store are you visiting?">
              <Select value={storeId} onChange={(e) => setStoreId(e.target.value)}>
                {state.stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </Field>
            <Field label="2. What is your budget for this trip ($)?">
              <Input type="number" min={5} step={5} value={budgetAmt} onChange={(e) => setBudgetAmt(Number(e.target.value))} />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="3. Is this budget strict or flexible?">
              <Chips
                options={[
                  { value: 'strict', label: 'Strict cap' },
                  { value: 'flex', label: 'Flexible (~10–15%)' },
                ]}
                value={strict ? 'strict' : 'flex'}
                onChange={(v) => setStrict(v === 'strict')}
              />
            </Field>
            <Field label="4. Shopping for how many days?">
              <div className="flex items-center gap-2">
                <Chips
                  options={[
                    { value: '3', label: '3d' },
                    { value: '5', label: '5d' },
                    { value: '7', label: '7d' },
                  ]}
                  value={customDays ? '3' : String(days)}
                  onChange={(v) => { setCustomDays(''); setDays(Number(v)); }}
                />
                <Input
                  type="number"
                  placeholder="Custom"
                  className="!w-24 !py-1.5"
                  value={customDays}
                  onChange={(e) => setCustomDays(e.target.value)}
                />
              </div>
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <Field label="5. Include non-food household items?">
              <Toggle checked={includeNonFood} onChange={setIncludeNonFood} label="Include paper towels, foil, soap, etc. if low" />
            </Field>
            <Field label="6. Prioritize lowest cost or convenience?">
              <Chips
                options={[
                  { value: 'cost', label: 'Lowest cost' },
                  { value: 'convenience', label: 'Convenience / quick prep' },
                ]}
                value={priority}
                onChange={(v) => setPriority(v as any)}
              />
            </Field>
          </div>
          <Toggle checked={includeLowStock} onChange={setIncludeLowStock} label="Also restock low-stock / out-of-stock staples" />
        </div>
      )}

      {step === 'meals' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-ink-3">
              Select the recipes & total servings you want to shop for ({effDays} days). We will consolidate shared ingredients and subtract what you already have in stock.
            </p>
            <Button size="sm" variant="ghost" onClick={() => setSelections([])}>Clear all</Button>
          </div>
          <div className="max-h-[50vh] overflow-y-auto divide-y divide-line border border-line rounded-2xl bg-white">
            {state.recipes.map((r) => {
              const sel = selections.find((s) => s.recipeId === r.id);
              const srv = sel?.servings ?? 0;
              return (
                <div key={r.id} className="px-3.5 py-2.5 flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{r.emoji} {r.name}</div>
                    <div className="text-xs text-ink-3 capitalize">{r.category} · {r.cuisine} · default {r.servings} srv</div>
                  </div>
                  <Stepper
                    value={`${srv} srv`}
                    onDec={() => {
                      const next = Math.max(0, srv - 1);
                      setSelections(next === 0 ? selections.filter((s) => s.recipeId !== r.id) : selections.map((s) => (s.recipeId === r.id ? { ...s, servings: next } : s)));
                    }}
                    onInc={() => {
                      const next = srv === 0 ? r.servings : srv + 1;
                      setSelections(srv === 0 ? [...selections, { recipeId: r.id, servings: next }] : selections.map((s) => (s.recipeId === r.id ? { ...s, servings: next } : s)));
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {step === 'review' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2.5">
            <div className="rounded-2xl border border-line p-3 bg-white">
              <div className="text-[11px] text-ink-3 uppercase">Trip Budget</div>
              <div className="text-lg font-semibold">{money(budgetAmt)} {strict ? '(strict)' : '(flex)'}</div>
            </div>
            <div className="rounded-2xl border border-line p-3 bg-white">
              <div className="text-[11px] text-ink-3 uppercase">Estimated Total</div>
              <div className={`text-lg font-semibold ${over > 0 ? 'text-amber-700' : 'text-brand-700'}`}>{money(total)}</div>
            </div>
            <div className="rounded-2xl border border-line p-3 bg-white">
              <div className="text-[11px] text-ink-3 uppercase">{over > 0 ? 'Over budget by' : 'Remaining'}</div>
              <div className={`text-lg font-semibold ${over > 0 ? 'text-red-700' : 'text-brand-700'}`}>{money(Math.abs(budgetAmt - total))}</div>
            </div>
          </div>

          {over > 0 && suggestions.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-soft p-3.5 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-xs text-amber-900">
                <AlertTriangle size={15} /> Estimated list exceeds budget by {money(over)} — approve any adjustments below (essential meal ingredients are never removed silently):
              </div>
              <div className="space-y-1.5">
                {suggestions.slice(0, 6).map((sg) => (
                  <div key={sg.id} className="flex items-center justify-between gap-2 bg-white/80 rounded-xl px-3 py-1.5 text-xs">
                    <span>{sg.label} <strong className="text-brand-700">(saves ~{money(sg.saves)})</strong></span>
                    <Button
                      size="sm"
                      variant="soft"
                      onClick={() => {
                        if (sg.type === 'substitute' && sg.toIngredientId) {
                          setItems(applySubstitute(state, items, sg.itemId, sg.toIngredientId, storeId));
                        } else {
                          setItems(items.map((it) => (it.id === sg.itemId ? { ...it, removed: true } : it)));
                        }
                      }}
                    >
                      Apply
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="max-h-[42vh] overflow-y-auto divide-y divide-line border border-line rounded-2xl bg-white">
            {items.filter((i) => !i.removed).map((i) => (
              <div key={i.id} className="px-3.5 py-2.5 flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`font-medium ${i.alreadyHave ? 'line-through text-ink-3' : ''}`}>{i.name}</span>
                    {i.verify && <Badge tone="amber">Verify kitchen stock</Badge>}
                    {!i.essential && <Badge tone="neutral">Low-stock restock</Badge>}
                    <Badge tone="outline">{i.priceSource === 'verified' ? 'Verified price' : i.priceSource === 'manual' ? 'Manual price' : 'Est. price'}</Badge>
                  </div>
                  <div className="text-xs text-ink-3">
                    Buy {fmtQU(i.quantity, i.unit)} · {money(i.estPrice)}
                    {i.forRecipes?.length ? ` · For: ${i.forRecipes.join(', ')}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant={i.alreadyHave ? 'soft' : 'ghost'}
                    onClick={() => setItems(items.map((x) => (x.id === i.id ? { ...x, alreadyHave: !x.alreadyHave } : x)))}
                  >
                    {i.alreadyHave ? 'Have it ✓' : 'Already have'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}

// ───────────────────────── 5. Add / Edit Inventory Modal ─────────────────────────
const CATEGORIES: { value: GroceryCategory; label: string }[] = [
  { value: 'protein', label: 'Meat & protein' },
  { value: 'dairy', label: 'Dairy & eggs' },
  { value: 'vegetables', label: 'Vegetables' },
  { value: 'fruits', label: 'Fruits' },
  { value: 'grains', label: 'Grains & bread' },
  { value: 'legumes', label: 'Beans & legumes' },
  { value: 'sauces', label: 'Sauces & condiments' },
  { value: 'spices', label: 'Spices & seasonings' },
  { value: 'oils', label: 'Oils & cooking' },
  { value: 'snacks', label: 'Snacks' },
  { value: 'drinks', label: 'Drinks' },
  { value: 'water', label: 'Water bottles' },
  { value: 'frozen', label: 'Frozen' },
  { value: 'household', label: 'Household' },
  { value: 'other', label: 'Other' },
];

export function AddEditInventoryModal() {
  const { addInvOpen, editInvItem, closeAddInv } = useModals();
  const state = useStore();

  const [ingredientId, setIngredientId] = useState<string>('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<GroceryCategory>('protein');
  const [location, setLocation] = useState('fridge');
  const [qtyStr, setQtyStr] = useState<string>('');
  const [unit, setUnit] = useState<Unit>('lb');
  const [minStr, setMinStr] = useState<string>('');
  const [purchaseDate, setPurchaseDate] = useState<string>('');
  const [expirationDate, setExpirationDate] = useState<string>('');
  const [brand, setBrand] = useState('');
  const [notes, setNotes] = useState('');
  const [priceStr, setPriceStr] = useState<string>('');
  const [frequent, setFrequent] = useState(false);
  const [bottleOz, setBottleOz] = useState<number>(16.9);

  useMemo(() => {
    if (!addInvOpen) return;
    if (editInvItem) {
      setIngredientId(editInvItem.ingredientId);
      setName(editInvItem.name);
      setCategory(editInvItem.category);
      setLocation(editInvItem.location);
      setQtyStr(editInvItem.quantity == null ? '' : String(editInvItem.quantity));
      setUnit(editInvItem.unit);
      setMinStr(editInvItem.minQuantity == null ? '' : String(editInvItem.minQuantity));
      setPurchaseDate(editInvItem.purchaseDate ?? '');
      setExpirationDate(editInvItem.expirationDate ?? '');
      setBrand(editInvItem.brand ?? '');
      setNotes(editInvItem.notes ?? '');
      setPriceStr(editInvItem.price == null ? '' : String(editInvItem.price));
      setFrequent(!!editInvItem.frequent);
      setBottleOz(editInvItem.bottleSizeOz ?? 16.9);
    } else {
      setIngredientId('');
      setName('');
      setCategory('protein');
      setLocation('fridge');
      setQtyStr('');
      setUnit('lb');
      setMinStr('');
      setPurchaseDate(todayISO());
      setExpirationDate('');
      setBrand('');
      setNotes('');
      setPriceStr('');
      setFrequent(false);
      setBottleOz(16.9);
    }
  }, [addInvOpen, editInvItem]);

  if (!addInvOpen) return null;

  const pickCatalog = (id: string) => {
    setIngredientId(id);
    const ing = state.ingredients.find((x) => x.id === id);
    if (ing) {
      setName(ing.name);
      setCategory(ing.category);
      setLocation(ing.defaultLocation);
      setUnit(ing.defaultUnit);
      if (ing.packagePrice != null) setPriceStr(String(ing.packagePrice));
    }
  };

  const save = () => {
    if (!name.trim()) return;
    const quantity = qtyStr.trim() === '' ? null : Number(qtyStr);
    const minQuantity = minStr.trim() === '' ? null : Number(minStr);
    const price = priceStr.trim() === '' ? undefined : Number(priceStr);
    const payload = {
      ingredientId: ingredientId || undefined,
      name: name.trim(),
      category,
      location,
      quantity,
      unit,
      minQuantity,
      purchaseDate: purchaseDate || undefined,
      expirationDate: expirationDate || undefined,
      brand: brand || undefined,
      notes: notes || undefined,
      price,
      frequent,
      bottleSizeOz: category === 'water' ? bottleOz : undefined,
      outOfStock: quantity === 0,
    };
    if (editInvItem) {
      state.updateItem(editInvItem.id, payload);
      toast(`Updated ${name}`);
    } else {
      state.addItem(payload);
      toast(`Added ${name} to ${location}`);
    }
    closeAddInv();
  };

  return (
    <Modal
      open={addInvOpen}
      onClose={closeAddInv}
      wide
      title={editInvItem ? `Edit ${editInvItem.name}` : 'Add Kitchen Inventory Item'}
      footer={
        <>
          <Button variant="secondary" onClick={closeAddInv}>Cancel</Button>
          <Button variant="primary" onClick={save}>{editInvItem ? 'Save changes' : 'Add to inventory'}</Button>
        </>
      }
    >
      <div className="space-y-3.5">
        {!editInvItem && (
          <Field label="Link to known ingredient (connects to recipes & grocery math)" hint="Or type any custom item name below">
            <Select value={ingredientId} onChange={(e) => pickCatalog(e.target.value)}>
              <option value="">— Custom / choose from catalog —</option>
              {state.ingredients.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.defaultUnit})</option>)}
            </Select>
          </Field>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Item name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Chicken breast" />
          </Field>
          <Field label="Category">
            <Select value={category} onChange={(e) => setCategory(e.target.value as GroceryCategory)}>
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </Select>
          </Field>
          <Field label="Storage location">
            <Select value={location} onChange={(e) => setLocation(e.target.value)}>
              {state.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Quantity" hint="Blank = Not specified">
              <Input type="number" step="any" placeholder="Not specified" value={qtyStr} onChange={(e) => setQtyStr(e.target.value)} />
            </Field>
            <Field label="Unit">
              <Select value={unit} onChange={(e) => setUnit(e.target.value as Unit)}>
                {ALL_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Minimum desired quantity (low-stock alert)">
            <Input type="number" step="any" placeholder="Optional" value={minStr} onChange={(e) => setMinStr(e.target.value)} />
          </Field>
          <Field label="Estimated purchase price ($)">
            <Input type="number" step="0.01" placeholder="Optional" value={priceStr} onChange={(e) => setPriceStr(e.target.value)} />
          </Field>
          <Field label="Purchase date">
            <Input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
          </Field>
          <Field label="Expiration date (leave blank if unknown)">
            <Input type="date" value={expirationDate} onChange={(e) => setExpirationDate(e.target.value)} />
          </Field>
          <Field label="Brand (optional)">
            <Input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. Trader Joe's" />
          </Field>
          {category === 'water' && (
            <Field label="Bottle size (fl oz)">
              <Select value={String(bottleOz)} onChange={(e) => setBottleOz(Number(e.target.value))}>
                {[8, 12, 16.9, 20, 24, 33.8, 128].map((oz) => <option key={oz} value={oz}>{oz} oz</option>)}
              </Select>
            </Field>
          )}
        </div>
        <Field label="Notes (optional)">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="!min-h-[60px]" />
        </Field>
        <Toggle checked={frequent} onChange={setFrequent} label="Frequently purchased staple" />
      </div>
    </Modal>
  );
}

// ───────────────────────── 6. Quick Weight Log Modal ─────────────────────────
export function WeightModal() {
  const { weightOpen, closeWeight } = useModals();
  const prefs = useStore((s) => s.prefs);
  const addWeight = useStore((s) => s.addWeight);

  const [date, setDate] = useState(todayISO());
  const [w, setW] = useState(String(prefs.weightLb || 176));
  const [waist, setWaist] = useState('');
  const [chest, setChest] = useState('');
  const [note, setNote] = useState('');

  if (!weightOpen) return null;

  const save = () => {
    const num = Number(w);
    if (!num) return;
    addWeight({
      date,
      weightLb: num,
      waistIn: waist ? Number(waist) : undefined,
      chestIn: chest ? Number(chest) : undefined,
      note: note || undefined,
    });
    toast(`Recorded ${num} lbs for ${date}`);
    closeWeight();
  };

  return (
    <Modal
      open={weightOpen}
      onClose={closeWeight}
      title="Record Weight & Measurements"
      footer={
        <>
          <Button variant="secondary" onClick={closeWeight}>Cancel</Button>
          <Button variant="primary" onClick={save}>Save entry</Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-xs text-ink-3">
          Daily weight fluctuates with water and food volume — we compare weekly averages rather than single weigh-ins.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Weight (lbs)"><Input type="number" step="0.1" value={w} onChange={(e) => setW(e.target.value)} /></Field>
          <Field label="Waist (inches, optional)"><Input type="number" step="0.25" value={waist} onChange={(e) => setWaist(e.target.value)} /></Field>
          <Field label="Chest (inches, optional)"><Input type="number" step="0.25" value={chest} onChange={(e) => setChest(e.target.value)} /></Field>
        </div>
        <Field label="Notes (optional)"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Morning weigh-in, post-workout, etc." /></Field>
      </div>
    </Modal>
  );
}
