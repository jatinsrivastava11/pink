import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { useModals } from '../components/modals';
import { ingMap, isInStock, isLowStock, recipeNutrition, suggestFor, LABEL_TEXT } from '../lib/engine';
import { expiryState, fmtDate, todayISO } from '../lib/dates';
import { fmtQU, money } from '../lib/units';
import { ZERO, addN, roundN } from '../lib/nutrition';
import { Badge, Button, Card, CardHeader, Input, ProgressBar, Ring, Stat, Stepper, toast } from '../components/ui';
import {
  AlertTriangle, ArrowRight, Calendar, ChefHat, Droplets, Flame, HeartHandshake, Package, Plus, Scale,
  ShoppingBag, ShoppingCart, Sparkles, Utensils, Wallet, Check,
} from 'lucide-react';

export function DashboardPage() {
  const state = useStore();
  const modals = useModals();
  const nav = useNavigate();
  const today = todayISO();
  const im = ingMap(state);

  // Today's nutrition
  const todayFood = state.foodLogs.filter((f) => f.date === today);
  const totals = roundN(todayFood.reduce((acc, f) => addN(acc, f.nutrition), ZERO));

  // Today's water
  const todayWater = state.waterLogs.filter((w) => w.date === today);
  const waterOz = Math.round(todayWater.reduce((s, w) => s + w.amountOz, 0) * 10) / 10;
  const [customWater, setCustomWater] = useState('12');

  // Water bottle stock
  const waterItems = state.inventory.filter((i) => i.category === 'water');
  const bottleItem = waterItems.find((i) => i.unit === 'bottle') ?? waterItems[0];
  const bottlesKnown = waterItems.filter((i) => i.unit === 'bottle' && i.quantity != null).reduce((s, i) => s + (i.quantity ?? 0), 0);
  const bottlesUnknown = waterItems.some((i) => i.unit === 'bottle' && i.quantity == null);

  // Inventory counts
  const stockedCount = state.inventory.filter(isInStock).length;
  const lowItems = state.inventory.filter(isLowStock);
  const expiringItems = state.inventory.filter((i) => {
    const st = expiryState(i.expirationDate);
    return isInStock(i) && (st === 'expired' || st === 'today' || st === 'soon3' || st === 'soon7');
  });
  const preparedAvailable = state.prepared.filter((p) => p.servings > 0);
  const totalPreparedServings = preparedAvailable.reduce((s, p) => s + p.servings, 0);

  // Today's planned meals
  const todayPlan = state.plan.entries.filter((e) => e.date === today).sort((a, b) => a.order - b.order);

  // Active or latest trip
  const activeTrip = state.trips.find((t) => t.status === 'shopping') ?? state.trips.at(-1);

  // Recommendations right now
  const recs = suggestFor(state, undefined, 4);

  const addWaterCase = (count: number, sizeOz = 16.9) => {
    if (bottleItem) {
      const next = (bottleItem.quantity ?? 0) + count;
      state.updateItem(bottleItem.id, { quantity: next, bottleSizeOz: sizeOz, outOfStock: false });
      toast(`Added ${count}-pack (${sizeOz} oz) → ${next} bottles in stock`);
    } else {
      state.addItem({ ingredientId: 'water-bottle', name: 'Bottled water', category: 'water', location: 'drinks', quantity: count, unit: 'bottle', bottleSizeOz: sizeOz, minQuantity: 6 });
      toast(`Added ${count} water bottles to stock`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top hero + Quick actions */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-brand-700">
            {fmtDate(today, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
          <h1 className="font-display text-[28px] sm:text-[34px] leading-tight mt-0.5">
            Good to see you, {state.prefs.name}.
          </h1>
          <p className="text-sm text-ink-2 mt-1">
            {totalPreparedServings > 0
              ? `You have ${totalPreparedServings} prepared meal ${totalPreparedServings === 1 ? 'serving' : 'servings'} ready and ${stockedCount} stocked kitchen items.`
              : `You have ${stockedCount} stocked kitchen items ready to cook with.`}
          </p>
        </div>

        {/* Support button prominent for evening/stress hunger */}
        <Button variant="soft" onClick={modals.openSupport} className="self-start lg:self-auto border border-brand-200">
          <HeartHandshake size={16} /> What do I need right now?
        </Button>
      </div>

      {/* Quick Action Bar — every button works */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <Button variant="secondary" onClick={() => modals.openAddInv(null)} className="justify-start">
          <Plus size={16} className="text-brand-600" /> Add inventory
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            state.logWater(state.prefs.defaultBottleOz, 'bottle');
            toast(`Logged ${state.prefs.defaultBottleOz} oz water bottle`);
          }}
          className="justify-start"
        >
          <Droplets size={16} className="text-sky-600" /> Log water
        </Button>
        <Button variant="secondary" onClick={() => nav('/planner')} className="justify-start">
          <Calendar size={16} className="text-brand-600" /> Plan a meal
        </Button>
        <Button variant="secondary" onClick={() => modals.openTrip()} className="justify-start">
          <ShoppingBag size={16} className="text-brand-600" /> Plan grocery trip
        </Button>
        <Button variant="secondary" onClick={modals.openWeight} className="justify-start">
          <Scale size={16} className="text-brand-600" /> Record weight
        </Button>
        <Button
          variant="primary"
          onClick={() => (activeTrip?.status === 'shopping' ? nav(`/groceries?trip=${activeTrip.id}`) : modals.openTrip())}
          className="justify-start"
        >
          <ShoppingCart size={16} /> Start shopping
        </Button>
      </div>

      {/* Key metrics row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Stat label="Protein today" value={`${totals.protein} / ${state.prefs.proteinTarget}g`} sub="Target: 120–140g" tone="green" />
        <Stat
          label="Calories (est.)"
          value={`${totals.kcal}`}
          sub={state.prefs.calorieTarget ? `of ~${state.prefs.calorieTarget} kcal` : 'No hard cap set'}
        />
        <Stat label="Prepared meals" value={`${totalPreparedServings} srv`} sub={`${preparedAvailable.length} ready to heat`} tone="green" />
        <Stat
          label="Water bottles"
          value={bottlesUnknown && bottlesKnown === 0 ? 'Verify qty' : `${bottlesKnown} left`}
          sub={`${waterOz} / ${state.prefs.waterGoalOz} oz drunk today`}
          tone={bottleItem && isLowStock(bottleItem) ? 'amber' : 'blue'}
        />
        <Stat label="Low / out of stock" value={lowItems.length} sub="Includes ground chicken" tone={lowItems.length ? 'amber' : undefined} />
        <Stat label="Current weight" value={`~${state.prefs.weightLb} lb`} sub="Healthy BMI · recomp focus" />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left 7 cols */}
        <div className="lg:col-span-7 space-y-5">
          {/* Prepared Meals Ready Right Now (the 4 ground chicken burgers!) */}
          <Card className="p-5">
            <CardHeader
              title="Prepared Meals Ready to Eat"
              subtitle="Eat a portion to deduct 1 serving and log nutrition — raw ingredients aren't deducted twice."
              icon={<ChefHat size={18} />}
              action={<Link to="/inventory?tab=prepared" className="text-xs font-medium text-brand-700 hover:underline">Manage all →</Link>}
            />
            {preparedAvailable.length === 0 ? (
              <div className="text-xs text-ink-3 py-4">No prepared meals in stock. Cook a batch from the Meals tab!</div>
            ) : (
              <div className="space-y-3">
                {preparedAvailable.map((p) => (
                  <div key={p.id} className="rounded-2xl border border-brand-100 bg-brand-50/40 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">🍔 {p.name}</span>
                        <Badge tone="green">{p.servings} {p.servings === 1 ? 'serving' : 'servings'} left</Badge>
                        <Badge tone="outline">{p.location}</Badge>
                      </div>
                      {p.nutrition && (
                        <div className="text-xs text-ink-2 mt-1">
                          Est. per serving: <strong>{p.nutrition.kcal} kcal · {p.nutrition.protein}g protein</strong> · {p.nutrition.carbs}g C · {p.nutrition.fat}g F
                        </div>
                      )}
                      {p.notes && <div className="text-[11px] text-ink-3 mt-0.5">{p.notes}</div>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Stepper
                        value={`${p.servings}`}
                        onDec={() => state.savePrepared({ ...p, servings: Math.max(0, p.servings - 1) })}
                        onInc={() => state.savePrepared({ ...p, servings: p.servings + 1 })}
                      />
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          state.eatPrepared(p.id, 1, 'any');
                          toast(`Ate 1 ${p.name} — ${p.servings - 1} remaining`);
                        }}
                      >
                        <Utensils size={14} /> Eat 1
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Today's Meals & Smart Suggestions */}
          <Card className="p-5">
            <CardHeader
              title="Today's Meals & What You Can Make Now"
              subtitle="Prioritizing your current kitchen inventory and protein target"
              icon={<Utensils size={18} />}
              action={<Link to="/planner" className="text-xs font-medium text-brand-700 hover:underline">Open planner →</Link>}
            />
            {todayPlan.length > 0 && (
              <div className="mb-4 space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-ink-3">Planned for today</div>
                {todayPlan.map((e) => {
                  const r = e.recipeId ? state.recipes.find((x) => x.id === e.recipeId) : undefined;
                  const pm = e.preparedMealId ? state.prepared.find((x) => x.id === e.preparedMealId) : undefined;
                  const title = r?.name ?? pm?.name ?? e.customName ?? 'Meal';
                  return (
                    <div key={e.id} className="flex items-center justify-between gap-2 rounded-xl border border-line px-3 py-2 text-sm">
                      <div>
                        <Badge tone="neutral" className="mr-2 capitalize">{e.slot}</Badge>
                        <span className={e.status === 'eaten' ? 'line-through text-ink-3' : 'font-medium'}>{title}</span>
                      </div>
                      {e.status !== 'eaten' ? (
                        <div className="flex gap-1.5">
                          {r && <Button size="sm" variant="soft" onClick={() => modals.openCook(r.id, { servings: e.servings, planEntryId: e.id })}>Cook</Button>}
                          <Button size="sm" variant="primary" onClick={() => { state.markEntryEaten(e.id); toast(`Marked ${title} eaten`); }}><Check size={14} /> Eaten</Button>
                        </div>
                      ) : <Badge tone="green">Eaten ✓</Badge>}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="text-xs font-semibold uppercase tracking-wide text-ink-3 mb-2">Recommended from your current stock</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {recs.map((s, idx) => {
                if (s.kind === 'prepared' && s.prepared) return null;
                const r = s.recipe!;
                const n = roundN(s.nutrition ?? recipeNutrition(r, im).perServing);
                return (
                  <div key={r.id + idx} className="rounded-2xl border border-line p-3 flex flex-col justify-between gap-2 hover:border-brand-300 transition">
                    <div className="flex gap-3">
                      {r.image ? (
                        <img src={r.image} alt={r.name} className="w-16 h-16 rounded-xl object-cover shrink-0 bg-line-2" />
                      ) : (
                        <div className="w-16 h-16 rounded-xl bg-brand-50 flex items-center justify-center text-2xl shrink-0">{r.emoji ?? '🍲'}</div>
                      )}
                      <div className="min-w-0">
                        <Link to={`/meals?recipe=${r.id}`} className="font-semibold text-sm hover:text-brand-700 line-clamp-1">{r.name}</Link>
                        <div className="text-xs text-ink-3 mt-0.5">{n.kcal} kcal · <strong>{n.protein}g P</strong> · {r.prepMin + r.cookMin}m</div>
                        {s.availability && (
                          <Badge tone={s.availability.label === 'can-make' ? 'green' : 'blue'} className="mt-1">
                            {LABEL_TEXT[s.availability.label]}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-end gap-1.5 pt-1">
                      <Button size="sm" variant="soft" onClick={() => modals.openCook(r.id)}>Cook / Prep</Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Right 5 cols */}
        <div className="lg:col-span-5 space-y-5">
          {/* Nutrition Progress Card */}
          <Card className="p-5">
            <CardHeader
              title="Today's Nutrition (Estimates)"
              subtitle="Supportive tracking — focus on protein & fiber for evening satiety"
              icon={<Flame size={18} />}
              action={<Link to="/nutrition" className="text-xs font-medium text-brand-700 hover:underline">Details →</Link>}
            />
            <div className="flex items-center gap-5">
              <Ring value={totals.protein} max={state.prefs.proteinTarget}>
                <div className="text-lg font-bold">{totals.protein}g</div>
                <div className="text-[10px] text-ink-3">of {state.prefs.proteinTarget}g P</div>
              </Ring>
              <div className="flex-1 space-y-2.5 text-xs">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-ink-2 font-medium">Protein (priority)</span>
                    <span>{totals.protein} / {state.prefs.proteinTarget} g</span>
                  </div>
                  <ProgressBar value={totals.protein} max={state.prefs.proteinTarget} tone="green" />
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-ink-2 font-medium">Fiber (fullness)</span>
                    <span>{totals.fiber} / {state.prefs.fiberTarget} g</span>
                  </div>
                  <ProgressBar value={totals.fiber} max={state.prefs.fiberTarget} tone="blue" />
                </div>
                <div className="flex justify-between pt-1 text-ink-3">
                  <span>Carbs: <strong className="text-ink">{totals.carbs}g</strong></span>
                  <span>Fat: <strong className="text-ink">{totals.fat}g</strong></span>
                  <span>Calories: <strong className="text-ink">~{totals.kcal}</strong></span>
                </div>
              </div>
            </div>
          </Card>

          {/* Dedicated Water Tracker & Bottle Stock Card */}
          <Card className="p-5">
            <CardHeader
              title="Water Tracker & Bottle Inventory"
              subtitle="Daily hydration is separate from bottled water stock"
              icon={<Droplets size={18} />}
            />
            <div className="space-y-3.5">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium">Drunk today: {waterOz} fl oz</span>
                  <span className="text-ink-3">Goal: {state.prefs.waterGoalOz} fl oz</span>
                </div>
                <ProgressBar value={waterOz} max={state.prefs.waterGoalOz} tone="blue" />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="soft"
                  onClick={() => {
                    state.logWater(state.prefs.glassOz, 'glass', false);
                    toast(`+${state.prefs.glassOz} oz glass logged`);
                  }}
                >
                  + 1 Glass ({state.prefs.glassOz} oz)
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => {
                    const oz = bottleItem?.bottleSizeOz ?? state.prefs.defaultBottleOz;
                    state.logWater(oz, 'bottle', true);
                    toast(`+1 bottle (${oz} oz) logged & deducted from stock`);
                  }}
                >
                  + 1 Bottle ({bottleItem?.bottleSizeOz ?? state.prefs.defaultBottleOz} oz)
                </Button>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    className="!w-16 !py-1 !px-2 text-xs"
                    value={customWater}
                    onChange={(e) => setCustomWater(e.target.value)}
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      const n = Number(customWater);
                      if (n > 0) {
                        state.logWater(n, 'custom', false);
                        toast(`+${n} oz water logged`);
                      }
                    }}
                  >
                    + oz
                  </Button>
                </div>
              </div>

              {/* Bottled water stock box */}
              <div className="rounded-2xl border border-line bg-canvas p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold">Bottled Water Stock ({bottleItem?.bottleSizeOz ?? 16.9} oz bottles)</div>
                    <div className="text-[11px] text-ink-3">
                      {bottleItem?.quantity == null
                        ? 'Quantity not specified — tap +24 case or set count'
                        : `${bottleItem.quantity} bottles remaining`}
                    </div>
                  </div>
                  {bottleItem && (
                    <Stepper
                      value={bottleItem.quantity == null ? 'Set' : `${bottleItem.quantity}`}
                      onDec={() => {
                        const next = Math.max(0, (bottleItem.quantity ?? 1) - 1);
                        state.setQty(bottleItem.id, next);
                      }}
                      onInc={() => state.setQty(bottleItem.id, (bottleItem.quantity ?? 0) + 1)}
                    />
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <Button size="sm" variant="secondary" onClick={() => addWaterCase(24, 16.9)}>+ 24-pack (16.9 oz)</Button>
                  <Button size="sm" variant="secondary" onClick={() => addWaterCase(12, 16.9)}>+ 12-pack</Button>
                  <Button size="sm" variant="secondary" onClick={() => addWaterCase(35, 16.9)}>+ 35-pack</Button>
                  {bottleItem && (bottleItem.quantity ?? 0) >= 2 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        state.adjustQty(bottleItem.id, -2);
                        toast('Deducted 2 bottles from inventory');
                      }}
                    >
                      −2 bottles
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </Card>

          {/* Inventory Alerts & Next Grocery Trip */}
          <Card className="p-5 space-y-3">
            <CardHeader
              title="Stock Alerts & Grocery Budget"
              icon={<Package size={18} />}
              action={<Link to="/inventory" className="text-xs font-medium text-brand-700 hover:underline">Full inventory →</Link>}
            />
            {lowItems.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-amber-800 flex items-center gap-1">
                  <AlertTriangle size={13} /> Out of stock / running low ({lowItems.length})
                </div>
                {lowItems.slice(0, 4).map((i) => (
                  <div key={i.id} className="flex items-center justify-between text-xs bg-amber-soft/70 rounded-xl px-3 py-1.5">
                    <span className="font-medium">{i.name}</span>
                    <span className="text-amber-900">{i.outOfStock ? 'Out of stock' : fmtQU(i.quantity, i.unit)}</span>
                  </div>
                ))}
              </div>
            )}

            {expiringItems.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-red-700">Expiring soon ({expiringItems.length})</div>
                {expiringItems.slice(0, 3).map((i) => (
                  <div key={i.id} className="flex items-center justify-between text-xs bg-red-50 rounded-xl px-3 py-1.5">
                    <span>{i.name}</span>
                    <span className="text-red-700">Exp {i.expirationDate}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-2 border-t border-line flex items-center justify-between gap-2">
              <div className="text-xs">
                <div className="font-semibold flex items-center gap-1"><Wallet size={13} /> Next Grocery Trip</div>
                <div className="text-ink-3">
                  {activeTrip
                    ? `${state.stores.find((s) => s.id === activeTrip.storeId)?.name ?? 'Store'} · Budget ${money(activeTrip.budget.amount)} · Est. ${money(activeTrip.estimatedTotal)}`
                    : `Default budget ${money(state.prefs.defaultBudget)} (asked before every trip)`}
                </div>
              </div>
              <Button size="sm" variant="primary" onClick={() => modals.openTrip()}>
                Plan trip <ArrowRight size={14} />
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
