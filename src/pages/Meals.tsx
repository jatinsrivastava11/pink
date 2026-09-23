import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useStore } from '../lib/store';
import { useModals } from '../components/modals';
import { ingMap, recipeAvailability, recipeCostPerServing, recipeNutrition, LABEL_TEXT, planDeductions } from '../lib/engine';
import { fmtQU, money, ALL_UNITS } from '../lib/units';
import { roundN, scaleN } from '../lib/nutrition';
import { todayISO, uid } from '../lib/dates';
import type { Cuisine, MealCategory, Recipe, RecipeIngredient, RecipeTag, Unit } from '../types';
import { Badge, Button, Card, Chips, Empty, Field, IconButton, Input, Modal, PageHeader, Select, Stepper, Textarea, Toggle, toast } from '../components/ui';
import { ChefHat, Clock, Copy, Edit2, Heart, Plus, Search, Star, Trash2, CalendarPlus, Check } from 'lucide-react';

const ALL_TAGS: { value: RecipeTag; label: string }[] = [
  { value: 'high-protein', label: 'High protein' },
  { value: 'very-filling', label: 'Very filling' },
  { value: 'lower-calorie-density', label: 'Lower calorie density' },
  { value: 'quick', label: 'Quick (≤15m)' },
  { value: 'meal-prep', label: 'Meal prep' },
  { value: 'evening-meal', label: 'Evening meal' },
  { value: 'evening-snack', label: 'Evening snack' },
  { value: 'craving-friendly', label: 'Craving-friendly' },
  { value: 'budget-friendly', label: 'Budget-friendly' },
  { value: 'uses-expiring', label: 'Uses expiring' },
  { value: 'post-workout', label: 'Post-workout' },
  { value: 'pre-workout', label: 'Pre-workout' },
  { value: 'light', label: 'Light meal' },
  { value: 'no-cook', label: 'No-cook' },
  { value: 'sweet', label: 'Sweet' },
  { value: 'crunchy', label: 'Crunchy' },
];

export function MealsPage() {
  const state = useStore();
  const modals = useModals();
  const [params, setParams] = useSearchParams();
  const openId = params.get('recipe');

  const [cat, setCat] = useState<'all' | MealCategory>('all');
  const [cuisine, setCuisine] = useState<'all' | Cuisine>('all');
  const [filterMode, setFilterMode] = useState<'all' | 'can-make' | 'expiring' | 'favorites'>('all');
  const [sortBy, setSortBy] = useState<'match' | 'protein' | 'density' | 'quick' | 'cost' | 'filling'>('match');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Recipe | null>(null);
  const [creating, setCreating] = useState(false);

  const im = useMemo(() => ingMap(state), [state.ingredients]);

  const enriched = useMemo(() => {
    return state.recipes.map((r) => {
      const av = recipeAvailability(state, r, im);
      const nu = recipeNutrition(r, im);
      const cost = recipeCostPerServing(state, r, im);
      return { r, av, nu, cost };
    });
  }, [state, im]);

  const list = useMemo(() => {
    return enriched
      .filter(({ r, av }) => {
        if (cat !== 'all' && r.category !== cat) return false;
        if (cuisine !== 'all' && r.cuisine !== cuisine) return false;
        if (filterMode === 'can-make' && av.label !== 'can-make' && av.label !== 'substitutions') return false;
        if (filterMode === 'expiring' && !av.usesExpiring) return false;
        if (filterMode === 'favorites' && !r.favorite) return false;
        if (q) {
          const s = q.toLowerCase();
          const inName = r.name.toLowerCase().includes(s) || (r.description ?? '').toLowerCase().includes(s);
          const inIng = r.ingredients.some((i) => (im.get(i.ingredientId)?.name ?? i.ingredientId).toLowerCase().includes(s));
          if (!inName && !inIng) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'protein') return b.nu.perServing.protein - a.nu.perServing.protein;
        if (sortBy === 'density') return a.nu.density - b.nu.density;
        if (sortBy === 'quick') return a.r.prepMin + a.r.cookMin - (b.r.prepMin + b.r.cookMin);
        if (sortBy === 'cost') return a.cost - b.cost;
        if (sortBy === 'filling') {
          const fa = (a.r.tags.includes('very-filling') ? 50 : 0) + a.nu.perServing.protein + a.nu.perServing.fiber * 2;
          const fb = (b.r.tags.includes('very-filling') ? 50 : 0) + b.nu.perServing.protein + b.nu.perServing.fiber * 2;
          return fb - fa;
        }
        // default: inventory match first, then protein
        const order = { 'can-make': 0, substitutions: 1, 'missing-few': 2, shopping: 3 };
        if (order[a.av.label] !== order[b.av.label]) return order[a.av.label] - order[b.av.label];
        return b.nu.perServing.protein - a.nu.perServing.protein;
      });
  }, [enriched, cat, cuisine, filterMode, sortBy, q, im]);

  const activeItem = enriched.find((x) => x.r.id === openId);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Meal Library & Inventory-Aware Recipes"
        subtitle={`${state.recipes.length} flexible recipes connected directly to your kitchen stock — never a rigid diet.`}
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus size={16} /> Add recipe
          </Button>
        }
      />

      {/* Category chips */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Chips
          options={[
            { value: 'all', label: 'All meals', count: state.recipes.length },
            { value: 'breakfast', label: '🍳 Breakfast', count: state.recipes.filter((r) => r.category === 'breakfast').length },
            { value: 'lunch', label: '🥗 Lunch', count: state.recipes.filter((r) => r.category === 'lunch').length },
            { value: 'dinner', label: '🍛 Dinner', count: state.recipes.filter((r) => r.category === 'dinner').length },
            { value: 'snack', label: '🍐 Snacks & quick', count: state.recipes.filter((r) => r.category === 'snack').length },
          ]}
          value={cat}
          onChange={setCat}
        />

        <Chips
          options={[
            { value: 'all', label: 'All stock states' },
            { value: 'can-make', label: '✓ Can make now' },
            { value: 'expiring', label: '⏰ Uses expiring' },
            { value: 'favorites', label: '★ Favorites' },
          ]}
          value={filterMode}
          onChange={setFilterMode}
        />
      </div>

      {/* Search, cuisine & sort */}
      <div className="flex flex-col md:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by recipe or ingredient (e.g. paneer, tikka, eggs, rajma)..." className="!pl-9" />
        </div>
        <Select value={cuisine} onChange={(e) => setCuisine(e.target.value as any)} className="md:!w-44">
          <option value="all">All cuisines</option>
          {(['Indian', 'Mexican', 'Asian', 'Western', 'Italian', 'Fusion'] as Cuisine[]).map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
        <Select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="md:!w-52">
          <option value="match">Sort: Best inventory match</option>
          <option value="protein">Sort: Highest protein</option>
          <option value="filling">Sort: Most filling</option>
          <option value="density">Sort: Lowest calorie density</option>
          <option value="quick">Sort: Quickest prep</option>
          <option value="cost">Sort: Cheapest per serving</option>
        </Select>
      </div>

      {/* Recipe grid */}
      {list.length === 0 ? (
        <Empty title="No recipes match these filters" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map(({ r, av, nu, cost }) => {
            const p = roundN(nu.perServing);
            return (
              <Card key={r.id} className="overflow-hidden flex flex-col justify-between hover:border-brand-300 transition">
                <div>
                  <button
                    type="button"
                    onClick={() => setParams({ recipe: r.id })}
                    className="block w-full text-left relative"
                  >
                    {r.image ? (
                      <img src={r.image} alt={r.name} className="w-full h-44 object-cover bg-line-2" />
                    ) : (
                      <div className="w-full h-44 bg-brand-50 flex items-center justify-center text-5xl">{r.emoji ?? '🍲'}</div>
                    )}
                    <div className="absolute top-3 left-3 flex flex-wrap gap-1">
                      <Badge tone={av.label === 'can-make' ? 'green' : av.label === 'substitutions' ? 'blue' : av.label === 'missing-few' ? 'amber' : 'neutral'}>
                        {LABEL_TEXT[av.label]}
                      </Badge>
                      {av.usesExpiring && <Badge tone="red">Uses expiring</Badge>}
                    </div>
                    <button
                      type="button"
                      aria-label="Favorite"
                      onClick={(e) => {
                        e.stopPropagation();
                        state.saveRecipe({ ...r, favorite: !r.favorite });
                      }}
                      className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center shadow"
                    >
                      <Heart size={15} className={r.favorite ? 'fill-red-500 text-red-500' : 'text-ink-2'} />
                    </button>
                  </button>

                  <div className="p-4">
                    <div className="flex items-center justify-between gap-2 text-xs text-ink-3 mb-1">
                      <span className="capitalize">{r.cuisine} · {r.category}</span>
                      <span className="flex items-center gap-1"><Clock size={12} /> {r.prepMin + r.cookMin} min · ~{money(cost)}/srv</span>
                    </div>
                    <button type="button" onClick={() => setParams({ recipe: r.id })} className="font-semibold text-base text-left hover:text-brand-700">
                      {r.name}
                    </button>
                    {r.description && <p className="text-xs text-ink-3 mt-1 line-clamp-2">{r.description}</p>}

                    <div className="mt-3 grid grid-cols-4 gap-1.5 text-center bg-canvas rounded-xl p-2 text-xs">
                      <div><div className="font-bold text-brand-700">{p.protein}g</div><div className="text-[10px] text-ink-3">Protein</div></div>
                      <div><div className="font-semibold">{p.kcal}</div><div className="text-[10px] text-ink-3">kcal</div></div>
                      <div><div className="font-semibold">{p.carbs}g</div><div className="text-[10px] text-ink-3">Carbs</div></div>
                      <div><div className="font-semibold">{p.fiber}g</div><div className="text-[10px] text-ink-3">Fiber</div></div>
                    </div>

                    <div className="flex flex-wrap gap-1 mt-2.5">
                      {r.tags.slice(0, 3).map((t) => (
                        <Badge key={t} tone="outline">{t}</Badge>
                      ))}
                      {av.extraCost > 0 && <Badge tone="amber">+{money(av.extraCost)} to shop</Badge>}
                    </div>
                  </div>
                </div>

                <div className="px-4 py-3 border-t border-line-2 flex items-center justify-between gap-2 bg-canvas/40">
                  <Button size="sm" variant="ghost" onClick={() => setParams({ recipe: r.id })}>
                    Details & deductions
                  </Button>
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        state.addEntry({ date: todayISO(), slot: r.category === 'snack' ? 'snack' : r.category, recipeId: r.id, servings: 1, status: 'planned' });
                        toast(`Added ${r.name} to today's plan`);
                      }}
                    >
                      <CalendarPlus size={14} /> Plan
                    </Button>
                    <Button size="sm" variant="primary" onClick={() => modals.openCook(r.id)}>
                      <ChefHat size={14} /> Cook
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Recipe Detail Modal */}
      {activeItem && (
        <RecipeDetailModal
          recipe={activeItem.r}
          onClose={() => setParams({})}
          onEdit={() => { setEditing(activeItem.r); setParams({}); }}
        />
      )}

      {/* Create / Edit Modal */}
      {(creating || editing) && (
        <RecipeEditorModal
          initial={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
        />
      )}
    </div>
  );
}

function RecipeDetailModal({ recipe, onClose, onEdit }: { recipe: Recipe; onClose: () => void; onEdit: () => void }) {
  const state = useStore();
  const modals = useModals();
  const [servings, setServings] = useState(recipe.servings);
  const [notes, setNotes] = useState(recipe.notes ?? '');

  const im = ingMap(state);
  const av = recipeAvailability(state, recipe, im, servings);
  const nu = recipeNutrition(recipe, im);
  const per = roundN(nu.perServing);
  const totalForBatch = roundN(scaleN(nu.perServing, servings));
  const deds = planDeductions(state, recipe, servings, im);
  const cost = recipeCostPerServing(state, recipe, im);

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={
        <div className="flex items-center gap-2">
          <span>{recipe.emoji ?? '🍲'} {recipe.name}</span>
          <Badge tone={av.label === 'can-make' ? 'green' : av.label === 'substitutions' ? 'blue' : 'amber'}>
            {LABEL_TEXT[av.label]}
          </Badge>
        </div>
      }
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2 w-full">
          <div className="flex gap-1.5">
            <Button size="sm" variant="secondary" onClick={onEdit}><Edit2 size={14} /> Edit</Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                state.duplicateRecipe(recipe.id);
                toast('Recipe duplicated');
              }}
            >
              <Copy size={14} /> Duplicate
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                state.deleteRecipe(recipe.id);
                toast('Recipe deleted');
                onClose();
              }}
            >
              <Trash2 size={14} /> Delete
            </Button>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                state.addEntry({ date: todayISO(), slot: recipe.category === 'snack' ? 'snack' : recipe.category, recipeId: recipe.id, servings: 1, status: 'planned' });
                toast(`Planned ${recipe.name} for today`);
              }}
            >
              <CalendarPlus size={15} /> Add to Today
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                onClose();
                modals.openCook(recipe.id, { servings });
              }}
            >
              <ChefHat size={15} /> Cook / Meal-Prep ({servings} srv)
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {recipe.image && <img src={recipe.image} alt={recipe.name} className="w-full h-52 object-cover rounded-2xl" />}

        <div className="flex flex-wrap items-center justify-between gap-3 bg-canvas p-3.5 rounded-2xl border border-line">
          <div>
            <div className="text-xs text-ink-3">Scale servings (recalculates ingredients & deductions)</div>
            <div className="mt-1">
              <Stepper value={`${servings} servings`} onDec={() => setServings(Math.max(1, servings - 1))} onInc={() => setServings(servings + 1)} />
            </div>
          </div>
          <div className="text-xs">
            <div>Per serving (est.): <strong>{per.kcal} kcal · {per.protein}g P</strong> · {per.carbs}g C · {per.fat}g F · {per.fiber}g fiber</div>
            <div className="text-ink-3 mt-0.5">Total for {servings} srv: {totalForBatch.kcal} kcal · {totalForBatch.protein}g P · Est. {money(cost)}/srv</div>
          </div>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => state.saveRecipe({ ...recipe, rating: star })}
                className="p-0.5"
              >
                <Star size={16} className={(recipe.rating ?? 0) >= star ? 'fill-amber-400 text-amber-400' : 'text-line'} />
              </button>
            ))}
          </div>
        </div>

        {/* Ingredients + exact stock & deduction preview */}
        <div>
          <h4 className="font-semibold text-sm mb-2">Ingredients & What Will Be Deducted ({servings} {servings === 1 ? 'serving' : 'servings'})</h4>
          <div className="divide-y divide-line border border-line rounded-2xl bg-white">
            {av.items.map((it, i) => {
              const ded = deds.find((d) => d.ingredientId === it.ri.ingredientId);
              return (
                <div key={i} className="px-3.5 py-2 flex items-center justify-between gap-2 text-sm">
                  <div>
                    <span className="font-medium">{it.ing?.name ?? it.ri.ingredientId}</span>
                    {it.ri.optional && <span className="text-xs text-ink-3 ml-1">(optional)</span>}
                    {it.ri.note && <span className="text-xs text-ink-3 ml-1">— {it.ri.note}</span>}
                    {ded && ded.before != null && (
                      <div className="text-[11px] text-ink-3">
                        Stock {fmtQU(ded.before, ded.unit)} → after cooking: <strong>{fmtQU(ded.after, ded.unit)}</strong>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="tabular-nums font-medium">{fmtQU(it.need, it.ri.unit)}</span>
                    <Badge
                      tone={
                        it.status === 'have' ? 'green'
                          : it.status === 'verify' ? 'blue'
                            : it.status === 'substitute' ? 'amber'
                              : 'red'
                      }
                    >
                      {it.status === 'have' ? 'In stock'
                        : it.status === 'verify' ? 'In stock (qty unverified)'
                          : it.status === 'substitute' ? `Sub: ${im.get(it.substituteId!)?.name ?? it.substituteId}`
                            : it.status === 'partial' ? `Have ${fmtQU(it.have, it.ri.unit)}`
                              : 'Missing'}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Step-by-step instructions */}
        <div>
          <h4 className="font-semibold text-sm mb-2">Step-by-step Instructions ({recipe.prepMin}m prep · {recipe.cookMin}m cook)</h4>
          <ol className="space-y-2 text-sm list-decimal list-inside bg-white border border-line rounded-2xl p-4">
            {recipe.steps.map((s, i) => <li key={i} className="leading-relaxed">{s}</li>)}
          </ol>
        </div>

        {/* Storage & reheating */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="rounded-2xl border border-line p-3 bg-canvas">
            <div className="font-semibold mb-1">Storage & Freezer Guidance</div>
            <div className="text-ink-2">{recipe.storage}</div>
          </div>
          <div className="rounded-2xl border border-line p-3 bg-canvas">
            <div className="font-semibold mb-1">Reheating Instructions</div>
            <div className="text-ink-2">{recipe.reheating}</div>
          </div>
        </div>

        {/* Personal cooking notes & flags */}
        <div className="space-y-2">
          <Field label="Your personal cooking notes">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => state.saveRecipe({ ...recipe, notes })}
              placeholder="Add spice tweaks, pan timings, or how filling this felt..."
            />
          </Field>
          <Toggle
            checked={!!recipe.frequent}
            onChange={(v) => state.saveRecipe({ ...recipe, frequent: v })}
            label="Frequently repeated go-to meal"
          />
        </div>
      </div>
    </Modal>
  );
}

function RecipeEditorModal({ initial, onClose }: { initial: Recipe | null; onClose: () => void }) {
  const state = useStore();
  const [name, setName] = useState(initial?.name ?? '');
  const [cuisine, setCuisine] = useState<Cuisine>(initial?.cuisine ?? 'Indian');
  const [category, setCategory] = useState<MealCategory>(initial?.category ?? 'dinner');
  const [prepMin, setPrepMin] = useState(initial?.prepMin ?? 10);
  const [cookMin, setCookMin] = useState(initial?.cookMin ?? 15);
  const [servings, setServings] = useState(initial?.servings ?? 2);
  const [description, setDescription] = useState(initial?.description ?? '');
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>(
    initial?.ingredients ?? [{ ingredientId: 'chicken-breast', quantity: 200, unit: 'g' }],
  );
  const [stepsText, setStepsText] = useState((initial?.steps ?? ['Prep ingredients.', 'Cook thoroughly and serve.']).join('\n'));
  const [tags, setTags] = useState<RecipeTag[]>(initial?.tags ?? ['high-protein']);
  const [storage, setStorage] = useState(initial?.storage ?? 'Refrigerate in an airtight container up to 3 days.');
  const [reheating, setReheating] = useState(initial?.reheating ?? 'Microwave covered 90–120 seconds until steaming hot.');

  const save = () => {
    if (!name.trim()) return;
    const now = new Date().toISOString();
    const rec: Recipe = {
      id: initial?.id ?? uid('rec-'),
      name: name.trim(),
      emoji: initial?.emoji ?? '🍲',
      image: initial?.image,
      cuisine,
      category,
      prepMin,
      cookMin,
      servings: Math.max(1, servings),
      description,
      ingredients: ingredients.filter((i) => i.ingredientId && i.quantity > 0),
      steps: stepsText.split('\n').map((s) => s.trim()).filter(Boolean),
      tags,
      storage,
      reheating,
      fridgeDays: initial?.fridgeDays ?? 3,
      freezerDays: initial?.freezerDays ?? 0,
      favorite: initial?.favorite,
      frequent: initial?.frequent,
      rating: initial?.rating,
      notes: initial?.notes,
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
    };
    state.saveRecipe(rec);
    toast(initial ? `Updated ${rec.name}` : `Created ${rec.name}`);
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={initial ? `Edit Recipe: ${initial.name}` : 'Create New Recipe'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save}><Check size={16} /> Save recipe</Button>
        </>
      }
    >
      <div className="space-y-3.5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Recipe name" className="sm:col-span-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Spicy Paneer Tikka Bowl" />
          </Field>
          <Field label="Cuisine">
            <Select value={cuisine} onChange={(e) => setCuisine(e.target.value as Cuisine)}>
              {(['Indian', 'Mexican', 'Asian', 'Western', 'Italian', 'Fusion'] as Cuisine[]).map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Category">
            <Select value={category} onChange={(e) => setCategory(e.target.value as MealCategory)}>
              <option value="breakfast">Breakfast</option>
              <option value="lunch">Lunch</option>
              <option value="dinner">Dinner</option>
              <option value="snack">Snack / Quick</option>
            </Select>
          </Field>
          <Field label="Prep (min)"><Input type="number" value={prepMin} onChange={(e) => setPrepMin(Number(e.target.value))} /></Field>
          <Field label="Cook (min)"><Input type="number" value={cookMin} onChange={(e) => setCookMin(Number(e.target.value))} /></Field>
          <Field label="Servings"><Input type="number" min={1} value={servings} onChange={(e) => setServings(Number(e.target.value))} /></Field>
          <Field label="Short description" className="sm:col-span-2">
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
        </div>

        {/* Ingredients builder */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-ink-2">Ingredients (connected to inventory & nutrition)</span>
            <Button
              size="sm"
              variant="soft"
              onClick={() => setIngredients([...ingredients, { ingredientId: state.ingredients[0].id, quantity: 100, unit: 'g' }])}
            >
              + Add ingredient
            </Button>
          </div>
          <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
            {ingredients.map((ri, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-6">
                  <Select
                    value={ri.ingredientId}
                    onChange={(e) => {
                      const ing = state.ingredients.find((x) => x.id === e.target.value);
                      setIngredients(ingredients.map((x, i) => (i === idx ? { ...x, ingredientId: e.target.value, unit: ing?.defaultUnit ?? x.unit } : x)));
                    }}
                  >
                    {state.ingredients.map((ing) => <option key={ing.id} value={ing.id}>{ing.name}</option>)}
                  </Select>
                </div>
                <div className="col-span-3">
                  <Input
                    type="number"
                    step="any"
                    value={ri.quantity}
                    onChange={(e) => setIngredients(ingredients.map((x, i) => (i === idx ? { ...x, quantity: Number(e.target.value) } : x)))}
                  />
                </div>
                <div className="col-span-2">
                  <Select
                    value={ri.unit}
                    onChange={(e) => setIngredients(ingredients.map((x, i) => (i === idx ? { ...x, unit: e.target.value as Unit } : x)))}
                  >
                    {ALL_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </Select>
                </div>
                <div className="col-span-1 flex justify-end">
                  <IconButton label="Remove ingredient" onClick={() => setIngredients(ingredients.filter((_, i) => i !== idx))}>
                    <Trash2 size={14} />
                  </IconButton>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Field label="Cooking steps (one step per line)">
          <Textarea value={stepsText} onChange={(e) => setStepsText(e.target.value)} />
        </Field>

        <Field label="Purpose tags">
          <div className="flex flex-wrap gap-1.5">
            {ALL_TAGS.map((t) => {
              const on = tags.includes(t.value);
              return (
                <button
                  type="button"
                  key={t.value}
                  onClick={() => setTags(on ? tags.filter((x) => x !== t.value) : [...tags, t.value])}
                  className={`px-2.5 py-1 rounded-full text-xs border ${on ? 'bg-brand-600 text-white border-brand-600' : 'bg-white border-line text-ink-2'}`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Storage guidance"><Input value={storage} onChange={(e) => setStorage(e.target.value)} /></Field>
          <Field label="Reheating instructions"><Input value={reheating} onChange={(e) => setReheating(e.target.value)} /></Field>
        </div>
      </div>
    </Modal>
  );
}
