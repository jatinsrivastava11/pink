import { useState, useMemo } from 'react';
import { useStore } from '../lib/store';
import { useModals } from '../components/modals';
import { ingMap, recipeNutrition, suggestFor, type Mood, buildGroceryItems } from '../lib/engine';
import { addDays, fmtDate, todayISO, weekStart, weekdayShort } from '../lib/dates';
import { fmtQU } from '../lib/units';
import { roundN } from '../lib/nutrition';
import type { MealSlot } from '../types';
import { Badge, Button, Card, Chips, Field, IconButton, Modal, PageHeader, Select, Stepper, toast } from '../components/ui';
import {
  ArrowLeft, ArrowRight, Calendar, Check, ChefHat, Copy, Dumbbell, Flame, Plus, Printer, RefreshCw,
  ShoppingBag, Sparkles, Trash2, Utensils, X,
} from 'lucide-react';

const HUNGER_MODES: { value: Mood; label: string }[] = [
  { value: 'very-hungry', label: "🔥 I'm very hungry" },
  { value: 'moderate', label: "🍽️ I'm moderately hungry" },
  { value: 'not-hungry', label: "🪶 I'm not very hungry" },
  { value: 'quick', label: '⚡ I want something quick' },
  { value: 'tasty', label: '🌶️ I want something tasty' },
  { value: 'stressed', label: "😮‍💨 Stressed & don't want to cook" },
];

export function PlannerPage() {
  const state = useStore();
  const modals = useModals();
  const today = todayISO();

  const [tab, setTab] = useState<'calendar' | 'prep'>('calendar');
  const [ws, setWs] = useState(() => weekStart(today));
  const [mood, setMood] = useState<Mood>('very-hungry');
  const [addingDate, setAddingDate] = useState<string | null>(null);
  const [addingSlot, setAddingSlot] = useState<MealSlot>('dinner');
  const [dragId, setDragId] = useState<string | null>(null);

  // Batch meal-prep planner state
  const [prepSelections, setPrepSelections] = useState<{ recipeId: string; servings: number }[]>([
    { recipeId: 'chicken-tikka-bowl', servings: 4 },
    { recipeId: 'rajma-chawal', servings: 3 },
  ]);
  const [prepChecklist, setPrepChecklist] = useState<Record<string, boolean>>({});

  const im = ingMap(state);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(ws, i)), [ws]);
  const moodSuggestions = useMemo(() => suggestFor(state, mood, 4), [state, mood]);

  const shopForWeek = () => {
    const entries = state.plan.entries.filter((e) => e.date >= ws && e.date < addDays(ws, 7) && e.status === 'planned' && e.recipeId);
    const map = new Map<string, number>();
    for (const e of entries) map.set(e.recipeId!, (map.get(e.recipeId!) ?? 0) + e.servings);
    modals.openTrip([...map.entries()].map(([recipeId, servings]) => ({ recipeId, servings })));
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Flexible Meal Planner & Batch Prep"
        subtitle="Adapt to your actual hunger. Drag meals between days, swap anytime, or batch-prep 2–3× a week."
        actions={
          <div className="flex flex-wrap gap-2 no-print">
            <Chips
              options={[
                { value: 'calendar', label: '📅 Weekly Calendar' },
                { value: 'prep', label: '🍱 Meal-Prep Session Builder' },
              ]}
              value={tab}
              onChange={(v) => setTab(v as any)}
            />
            <Button variant="secondary" onClick={() => window.print()}><Printer size={15} /> Print</Button>
          </div>
        }
      />

      {tab === 'calendar' && (
        <>
          {/* Hunger-based adaptive suggestion strip */}
          <Card className="p-4 space-y-3 no-print">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-brand-700 flex items-center gap-1.5">
                <Sparkles size={14} /> How are you feeling right now? (Adaptive suggestions)
              </div>
              <Chips options={HUNGER_MODES} value={mood} onChange={setMood} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {moodSuggestions.map((s, i) => {
                if (s.kind === 'prepared' && s.prepared) {
                  const p = s.prepared;
                  return (
                    <div key={p.id} className="rounded-xl border border-brand-200 bg-brand-50/50 p-3 flex flex-col justify-between gap-2">
                      <div>
                        <Badge tone="green">Ready now ({p.servings} left)</Badge>
                        <div className="font-semibold text-sm mt-1">🍔 {p.name}</div>
                        <div className="text-[11px] text-ink-3">{p.nutrition?.kcal} kcal · {p.nutrition?.protein}g P</div>
                      </div>
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => {
                          state.eatPrepared(p.id, 1, 'any');
                          toast(`Ate 1 ${p.name}`);
                        }}
                      >
                        Eat 1 now
                      </Button>
                    </div>
                  );
                }
                const r = s.recipe!;
                const n = roundN(s.nutrition ?? recipeNutrition(r, im).perServing);
                return (
                  <div key={r.id + i} className="rounded-xl border border-line bg-white p-3 flex flex-col justify-between gap-2">
                    <div>
                      <div className="font-semibold text-sm truncate">{r.emoji} {r.name}</div>
                      <div className="text-[11px] text-ink-3">{n.kcal} kcal · <strong>{n.protein}g P</strong> · {r.prepMin + r.cookMin}m</div>
                    </div>
                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        variant="soft"
                        onClick={() => {
                          state.addEntry({ date: today, slot: r.category === 'snack' ? 'snack' : r.category, recipeId: r.id, servings: 1, status: 'planned' });
                          toast(`Added ${r.name} to today`);
                        }}
                      >
                        + Today
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => modals.openCook(r.id, { servings: 1 })}>Cook</Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Week controls */}
          <div className="flex flex-wrap items-center justify-between gap-2 no-print">
            <div className="flex items-center gap-2">
              <IconButton label="Previous week" onClick={() => setWs(addDays(ws, -7))}><ArrowLeft size={16} /></IconButton>
              <span className="font-semibold text-sm">
                Week of {fmtDate(ws)} – {fmtDate(addDays(ws, 6))}
              </span>
              <IconButton label="Next week" onClick={() => setWs(addDays(ws, 7))}><ArrowRight size={16} /></IconButton>
              <Button size="sm" variant="ghost" onClick={() => setWs(weekStart(today))}>This week</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  const n = state.copyWeek(addDays(ws, -7), ws);
                  toast(n ? `Copied ${n} meals from last week` : 'No meals found in last week');
                }}
              >
                <Copy size={14} /> Reuse last week
              </Button>
              <Button
                size="sm"
                variant="soft"
                onClick={() => {
                  state.generateWeek(ws, { days: 7, replace: true });
                  toast('Generated flexible 7-day plan using your current inventory & prepped burgers');
                }}
              >
                <RefreshCw size={14} /> Auto-fill week
              </Button>
              <Button size="sm" variant="primary" onClick={shopForWeek}>
                <ShoppingBag size={14} /> Shop for this week
              </Button>
            </div>
          </div>

          {/* 7-day grid with drag & drop */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3 print-full">
            {days.map((d) => {
              const dayEntries = state.plan.entries.filter((e) => e.date === d).sort((a, b) => a.order - b.order);
              const isWorkout = state.plan.workoutDays.includes(d);
              const isToday = d === today;
              const dayProtein = dayEntries.reduce((sum, e) => {
                if (e.status === 'skipped') return sum;
                if (e.preparedMealId) {
                  const pm = state.prepared.find((p) => p.id === e.preparedMealId);
                  return sum + (pm?.nutrition?.protein ?? 0) * e.servings;
                }
                if (e.recipeId) {
                  const r = state.recipes.find((x) => x.id === e.recipeId);
                  return sum + (r ? recipeNutrition(r, im).perServing.protein * e.servings : 0);
                }
                return sum;
              }, 0);

              return (
                <Card
                  key={d}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragId) {
                      state.moveEntry(dragId, d);
                      setDragId(null);
                    }
                  }}
                  className={`p-3 flex flex-col justify-between min-h-[260px] ${isToday ? 'ring-2 ring-brand-500' : ''}`}
                >
                  <div>
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-line-2">
                      <div>
                        <div className="text-xs font-bold uppercase text-ink-3">{weekdayShort(d)}</div>
                        <div className="text-sm font-semibold">{fmtDate(d)}</div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          title="Toggle resistance training day"
                          onClick={() => state.toggleWorkoutDay(d)}
                          className={`p-1.5 rounded-lg text-xs ${isWorkout ? 'bg-brand-600 text-white' : 'bg-line-2 text-ink-3'}`}
                        >
                          <Dumbbell size={13} />
                        </button>
                      </div>
                    </div>

                    <div className="text-[11px] text-ink-3 mb-2">
                      Est. protein: <strong className="text-brand-700">{Math.round(dayProtein)}g</strong>
                      {isWorkout && <Badge tone="green" className="ml-1">Lift day</Badge>}
                    </div>

                    <div className="space-y-2">
                      {dayEntries.map((e) => {
                        const r = e.recipeId ? state.recipes.find((x) => x.id === e.recipeId) : undefined;
                        const pm = e.preparedMealId ? state.prepared.find((x) => x.id === e.preparedMealId) : undefined;
                        const title = r?.name ?? pm?.name ?? e.customName ?? 'Meal';
                        return (
                          <div
                            key={e.id}
                            draggable
                            onDragStart={() => setDragId(e.id)}
                            className={`rounded-xl border p-2 text-xs cursor-grab active:cursor-grabbing ${
                              e.status === 'eaten'
                                ? 'bg-brand-50/60 border-brand-200'
                                : e.status === 'skipped'
                                  ? 'opacity-50 bg-line-2 border-line'
                                  : 'bg-white border-line'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="uppercase text-[10px] font-semibold text-ink-3">{e.slot}</span>
                              <div className="flex items-center gap-1 no-print">
                                {e.status !== 'eaten' && (
                                  <button
                                    title="Mark eaten"
                                    onClick={() => {
                                      state.markEntryEaten(e.id);
                                      toast(`Logged ${title}`);
                                    }}
                                    className="text-brand-700 hover:bg-brand-100 rounded p-0.5"
                                  >
                                    <Check size={12} />
                                  </button>
                                )}
                                {r && e.status === 'planned' && (
                                  <button
                                    title="Cook / prep"
                                    onClick={() => modals.openCook(r.id, { servings: e.servings, planEntryId: e.id })}
                                    className="text-ink-2 hover:bg-line-2 rounded p-0.5"
                                  >
                                    <ChefHat size={12} />
                                  </button>
                                )}
                                <button
                                  title="Skip / unskip"
                                  onClick={() => state.updateEntry(e.id, { status: e.status === 'skipped' ? 'planned' : 'skipped' })}
                                  className="text-ink-3 hover:text-ink rounded p-0.5"
                                >
                                  <X size={12} />
                                </button>
                                <button title="Remove" onClick={() => state.removeEntry(e.id)} className="text-ink-3 hover:text-red-600 rounded p-0.5">
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                            <div className={`font-medium mt-0.5 ${e.status === 'skipped' ? 'line-through' : ''}`}>
                              {r?.emoji ?? (pm ? '🍱' : '🍽️')} {title}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setAddingDate(d)}
                    className="mt-3 w-full py-1.5 rounded-xl border border-dashed border-line text-xs text-ink-3 hover:border-brand-400 hover:text-brand-700 flex items-center justify-center gap-1 no-print"
                  >
                    <Plus size={13} /> Add meal / snack
                  </button>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {tab === 'prep' && (
        <MealPrepBuilder
          selections={prepSelections}
          setSelections={setPrepSelections}
          checklist={prepChecklist}
          setChecklist={setPrepChecklist}
        />
      )}

      {/* Add meal to day modal */}
      {addingDate && (
        <Modal open onClose={() => setAddingDate(null)} title={`Add Meal or Snack for ${fmtDate(addingDate)}`}>
          <div className="space-y-3">
            <Field label="Slot (flexible — no mandatory times)">
              <Chips
                options={[
                  { value: 'breakfast', label: 'Breakfast' },
                  { value: 'lunch', label: 'Lunch' },
                  { value: 'dinner', label: 'Dinner' },
                  { value: 'snack', label: 'Evening Snack' },
                ]}
                value={addingSlot}
                onChange={setAddingSlot}
              />
            </Field>

            {state.prepared.filter((p) => p.servings > 0).length > 0 && (
              <div>
                <div className="text-xs font-semibold text-ink-3 mb-1.5">Ready prepared meals</div>
                <div className="space-y-1.5">
                  {state.prepared.filter((p) => p.servings > 0).map((p) => (
                    <div key={p.id} className="flex items-center justify-between border border-brand-200 bg-brand-50/40 rounded-xl px-3 py-2 text-sm">
                      <span>🍱 {p.name} ({p.servings} left)</span>
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => {
                          state.addEntry({ date: addingDate, slot: addingSlot, preparedMealId: p.id, servings: 1, status: 'planned' });
                          setAddingDate(null);
                        }}
                      >
                        Add
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="text-xs font-semibold text-ink-3 mb-1.5">Recipes from your library</div>
              <div className="max-h-72 overflow-y-auto divide-y divide-line border border-line rounded-2xl">
                {state.recipes.map((r) => (
                  <div key={r.id} className="px-3 py-2 flex items-center justify-between text-sm">
                    <div>
                      <div className="font-medium">{r.emoji} {r.name}</div>
                      <div className="text-xs text-ink-3 capitalize">{r.category} · {r.prepMin + r.cookMin}m</div>
                    </div>
                    <Button
                      size="sm"
                      variant="soft"
                      onClick={() => {
                        state.addEntry({ date: addingDate, slot: addingSlot, recipeId: r.id, servings: 1, status: 'planned' });
                        setAddingDate(null);
                      }}
                    >
                      Add
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function MealPrepBuilder({
  selections,
  setSelections,
  checklist,
  setChecklist,
}: {
  selections: { recipeId: string; servings: number }[];
  setSelections: (s: { recipeId: string; servings: number }[]) => void;
  checklist: Record<string, boolean>;
  setChecklist: (c: Record<string, boolean>) => void;
}) {
  const state = useStore();
  const modals = useModals();
  const im = ingMap(state);

  // Combined ingredients across all selected batch recipes
  const combined = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; unit: string }>();
    for (const sel of selections) {
      const r = state.recipes.find((x) => x.id === sel.recipeId);
      if (!r || sel.servings <= 0) continue;
      const k = sel.servings / Math.max(1, r.servings);
      for (const ri of r.ingredients) {
        if (ri.optional) continue;
        const key = `${ri.ingredientId}:${ri.unit}`;
        const cur = map.get(key);
        const ing = im.get(ri.ingredientId);
        if (cur) cur.qty += ri.quantity * k;
        else map.set(key, { name: ing?.name ?? ri.ingredientId, qty: ri.quantity * k, unit: ri.unit });
      }
    }
    return [...map.values()];
  }, [selections, state.recipes, im]);

  const missingToBuy = useMemo(() => buildGroceryItems(state, selections, { includeLowStock: false }), [state, selections]);

  const cookEntireSession = () => {
    for (const sel of selections) {
      if (sel.servings > 0) {
        state.cook(sel.recipeId, {
          servings: sel.servings,
          eatNow: 0,
          storeRest: true,
          location: 'fridge',
          preparedDate: todayISO(),
        });
      }
    }
    toast('Meal-prep session complete! Portions added to Prepared Meals & stock updated.');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      <Card className="lg:col-span-7 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-base">1. Choose Meals & Portions to Batch-Prep</h3>
            <p className="text-xs text-ink-3">Prep 2–3× a week so 5-minute assembly meals are always waiting in the fridge.</p>
          </div>
          <Select
            className="!w-56"
            value=""
            onChange={(e) => {
              if (!e.target.value) return;
              const r = state.recipes.find((x) => x.id === e.target.value);
              if (r && !selections.some((s) => s.recipeId === r.id)) {
                setSelections([...selections, { recipeId: r.id, servings: Math.max(3, r.servings) }]);
              }
            }}
          >
            <option value="">+ Add recipe to prep session...</option>
            {state.recipes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </Select>
        </div>

        <div className="divide-y divide-line border border-line rounded-2xl">
          {selections.map((sel) => {
            const r = state.recipes.find((x) => x.id === sel.recipeId);
            if (!r) return null;
            return (
              <div key={sel.recipeId} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="font-semibold text-sm">{r.emoji} {r.name}</div>
                  <div className="text-xs text-ink-3">
                    Fridge: up to {r.fridgeDays ?? 3} days · {(r.freezerDays ?? 0) > 0 ? `Freezer: ${r.freezerDays} days` : 'Best refrigerated'}
                  </div>
                  <div className="text-[11px] text-ink-3 mt-0.5">Reheat: {r.reheating}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Stepper
                    value={`${sel.servings} portions`}
                    onDec={() => setSelections(selections.map((x) => (x.recipeId === sel.recipeId ? { ...x, servings: Math.max(1, x.servings - 1) } : x)))}
                    onInc={() => setSelections(selections.map((x) => (x.recipeId === sel.recipeId ? { ...x, servings: x.servings + 1 } : x)))}
                  />
                  <IconButton label="Remove" onClick={() => setSelections(selections.filter((x) => x.recipeId !== sel.recipeId))}>
                    <Trash2 size={15} />
                  </IconButton>
                </div>
              </div>
            );
          })}
        </div>

        {/* Prep Timeline & Checklist */}
        <div>
          <h4 className="font-semibold text-sm mb-2">2. Step-by-Step Prep Checklist & Food-Safety Timeline</h4>
          <div className="space-y-2 text-xs bg-canvas p-3.5 rounded-2xl border border-line">
            {[
              '00:00 — Start grains/legumes first (rice cooker or pressure cooker for rajma/chana/dal).',
              '00:10 — Marinate proteins (chicken breast/thighs or paneer in Greek yogurt + spices).',
              '00:20 — Chop aromatics & vegetables (onions, tomatoes, cauliflower, cucumber) in one batch.',
              '00:30 — Sear or roast proteins (425°F sheet pan or skillet) until 165°F / 74°C internal.',
              '00:50 — Whisk high-protein Greek-yogurt sauces (mint chutney yogurt, sriracha yogurt).',
              '01:00 — Cool food within 1–2 hours, label containers with today’s prep date, and refrigerate (eat within 3–4 days) or freeze.',
            ].map((step, idx) => (
              <label key={idx} className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!checklist[idx]}
                  onChange={() => setChecklist({ ...checklist, [idx]: !checklist[idx] })}
                  className="mt-0.5"
                />
                <span className={checklist[idx] ? 'line-through text-ink-3' : ''}>{step}</span>
              </label>
            ))}
          </div>
        </div>
      </Card>

      <Card className="lg:col-span-5 p-5 space-y-4">
        <h3 className="font-semibold text-base">Combined Batch Ingredients</h3>
        <div className="max-h-64 overflow-y-auto divide-y divide-line border border-line rounded-2xl text-xs">
          {combined.map((c, i) => (
            <div key={i} className="px-3 py-2 flex justify-between">
              <span>{c.name}</span>
              <span className="font-semibold">{fmtQU(c.qty, c.unit as any)}</span>
            </div>
          ))}
        </div>

        {missingToBuy.length > 0 && (
          <div className="rounded-2xl bg-amber-soft border border-amber-200 p-3 text-xs space-y-1.5">
            <div className="font-semibold text-amber-900">Need to purchase / verify ({missingToBuy.length} items)</div>
            {missingToBuy.slice(0, 5).map((m) => (
              <div key={m.id} className="flex justify-between">
                <span>{m.name}</span>
                <span>{fmtQU(m.quantity, m.unit)}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-2 pt-2">
          <Button variant="secondary" onClick={() => modals.openTrip(selections)}>
            <ShoppingBag size={15} /> Build Prep Shopping List
          </Button>
          <Button variant="primary" onClick={cookEntireSession}>
            <ChefHat size={15} /> Mark Prep Session Cooked & Store Portions
          </Button>
        </div>
      </Card>
    </div>
  );
}
