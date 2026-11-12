import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { useModals } from '../components/modals';
import { ingMap, isLowStock, recipeNutrition, suggestFor, LABEL_TEXT } from '../lib/engine';
import { fmtDate, todayISO } from '../lib/dates';
import { fmtQU, money } from '../lib/units';
import { ZERO, addN, roundN } from '../lib/nutrition';
import { Badge, Button, Card, ProgressBar, Stepper, toast } from '../components/ui';
import {
  AlertTriangle, ChevronDown, ChevronUp, Droplets, HeartHandshake, Plus, ShoppingBag, Utensils, Wifi,
} from 'lucide-react';

export function DashboardPage() {
  const state = useStore();
  const modals = useModals();
  const nav = useNavigate();
  const today = todayISO();
  const im = ingMap(state);
  const [showMore, setShowMore] = useState(false);

  // Today's nutrition
  const todayFood = state.foodLogs.filter((f) => f.date === today);
  const totals = roundN(todayFood.reduce((acc, f) => addN(acc, f.nutrition), ZERO));

  // Today's water & bottle stock
  const todayWater = state.waterLogs.filter((w) => w.date === today);
  const waterOz = Math.round(todayWater.reduce((s, w) => s + w.amountOz, 0) * 10) / 10;
  const waterItems = state.inventory.filter((i) => i.category === 'water');
  const bottleItem = waterItems.find((i) => i.unit === 'bottle') ?? waterItems[0];
  const bottlesKnown = waterItems.filter((i) => i.unit === 'bottle' && i.quantity != null).reduce((s, i) => s + (i.quantity ?? 0), 0);

  // Prepared meals & low stock
  const preparedAvailable = state.prepared.filter((p) => p.servings > 0);
  const lowItems = state.inventory.filter(isLowStock);

  // Top 3 simple meal ideas right now
  const recs = suggestFor(state, undefined, 4).filter((s) => s.kind === 'recipe').slice(0, 3);

  const addWaterCase = (count: number) => {
    if (bottleItem) {
      const next = (bottleItem.quantity ?? 0) + count;
      state.updateItem(bottleItem.id, { quantity: next, bottleSizeOz: 16.9, outOfStock: false });
      toast(`Added ${count}-pack → ${next} bottles in stock`);
    }
  };

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* Calm Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-brand-700 font-medium">
            <span>{fmtDate(today, { weekday: 'long', month: 'short', day: 'numeric' })}</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] text-brand-700 border border-brand-100">
              <Wifi size={11} /> Mac ↔ iPhone Live Sync Active
            </span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl mt-0.5">Hey {state.prefs.name} — what&apos;s the move?</h1>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="soft" onClick={modals.openSupport} className="border border-brand-200">
            <HeartHandshake size={16} /> Hungry / Stressed?
          </Button>
          <Button variant="primary" onClick={() => modals.openTrip()}>
            <ShoppingBag size={16} /> Plan Grocery Trip
          </Button>
        </div>
      </div>

      {/* 1. READY RIGHT NOW: Prepared Meals (Your 4 Chicken Burgers) */}
      <Card className="p-5 border-brand-200 bg-brand-50/30">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-semibold text-base">1. Ready in the Fridge Right Now</h2>
            <p className="text-xs text-ink-3">One tap to eat — logs your protein and updates your remaining count.</p>
          </div>
          <Link to="/inventory" className="text-xs font-medium text-brand-700 hover:underline">All kitchen stock →</Link>
        </div>

        {preparedAvailable.length === 0 ? (
          <div className="text-sm text-ink-3">No prepped meals left. Pick a meal below to cook a batch!</div>
        ) : (
          <div className="space-y-2.5">
            {preparedAvailable.map((p) => (
              <div key={p.id} className="rounded-2xl bg-white border border-line p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🍔</span>
                    <span className="font-semibold text-base">{p.name}</span>
                    <Badge tone="green">{p.servings} left</Badge>
                  </div>
                  {p.nutrition && (
                    <div className="text-xs text-ink-2 mt-1">
                      <strong>{p.nutrition.protein}g protein</strong> · ~{p.nutrition.kcal} kcal
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Stepper
                    value={`${p.servings}`}
                    onDec={() => state.savePrepared({ ...p, servings: Math.max(0, p.servings - 1) })}
                    onInc={() => state.savePrepared({ ...p, servings: p.servings + 1 })}
                  />
                  <Button
                    variant="primary"
                    onClick={() => {
                      state.eatPrepared(p.id, 1, 'any');
                      toast(`Ate 1 ${p.name} (${p.servings - 1} left)`);
                    }}
                  >
                    <Utensils size={15} /> Eat 1 Now
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* 2. TODAY'S PROTEIN & WATER (Simple 2-column card) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="p-5 flex flex-col justify-between gap-3">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-3">Today&apos;s Protein & Food</span>
              <Link to="/nutrition" className="text-xs text-brand-700 hover:underline">Log / Weight →</Link>
            </div>
            <div className="text-2xl font-bold mt-1">
              {totals.protein}g <span className="text-sm font-normal text-ink-3">/ {state.prefs.proteinTarget}g protein</span>
            </div>
            <ProgressBar value={totals.protein} max={state.prefs.proteinTarget} tone="green" className="mt-2" />
          </div>
          <div className="flex items-center justify-between text-xs text-ink-2 pt-2 border-t border-line-2">
            <span>Est. calories: <strong>{totals.kcal} kcal</strong></span>
            <span>Fiber: <strong>{totals.fiber}g</strong></span>
            <button onClick={modals.openWeight} className="text-brand-700 font-medium hover:underline">
              Weight: ~{state.prefs.weightLb} lb
            </button>
          </div>
        </Card>

        <Card className="p-5 flex flex-col justify-between gap-3">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-3">Water & Bottle Stock</span>
              <span className="text-xs text-sky-700 font-medium">
                {bottleItem?.quantity == null ? 'Stock not set' : `${bottlesKnown} bottles left`}
              </span>
            </div>
            <div className="text-2xl font-bold mt-1">
              {waterOz} oz <span className="text-sm font-normal text-ink-3">/ {state.prefs.waterGoalOz} oz today</span>
            </div>
            <ProgressBar value={waterOz} max={state.prefs.waterGoalOz} tone="blue" className="mt-2" />
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                state.logWater(16.9, 'bottle', true);
                toast('+1 bottle (16.9 oz) logged');
              }}
            >
              <Droplets size={14} /> +1 Bottle (16.9 oz)
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                state.logWater(8, 'glass', false);
                toast('+8 oz glass logged');
              }}
            >
              +1 Glass
            </Button>
            <Button size="sm" variant="ghost" onClick={() => addWaterCase(24)}>
              +24 pack to stock
            </Button>
          </div>
        </Card>
      </div>

      {/* 3. WHAT YOU CAN COOK IN 10-20 MIN WITH CURRENT STOCK */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-semibold text-base">2. Easy Meals Using What You Already Have</h2>
            <p className="text-xs text-ink-3">Matched to your current fridge & pantry.</p>
          </div>
          <Link to="/meals" className="text-xs font-medium text-brand-700 hover:underline">See all 52 meals →</Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {recs.map((s) => {
            const r = s.recipe!;
            const n = roundN(s.nutrition ?? recipeNutrition(r, im).perServing);
            return (
              <div key={r.id} className="rounded-2xl border border-line p-3.5 flex flex-col justify-between gap-3">
                <div>
                  <div className="flex items-center justify-between gap-1">
                    <Badge tone="green">{s.availability ? LABEL_TEXT[s.availability.label] : 'Ready'}</Badge>
                    <span className="text-xs text-ink-3">{r.prepMin + r.cookMin}m</span>
                  </div>
                  <Link to={`/meals?recipe=${r.id}`} className="font-semibold text-sm mt-2 block hover:text-brand-700">
                    {r.emoji} {r.name}
                  </Link>
                  <div className="text-xs text-ink-3 mt-0.5">
                    <strong>{n.protein}g protein</strong> · {n.kcal} kcal
                  </div>
                </div>
                <Button size="sm" variant="soft" onClick={() => modals.openCook(r.id)}>
                  Cook this
                </Button>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Optional Expandable Drawer for Extra Details (Low stock, Planner, Quick add) */}
      <div className="pt-1">
        <button
          type="button"
          onClick={() => setShowMore(!showMore)}
          className="w-full py-2.5 px-4 rounded-2xl border border-line bg-white text-xs font-medium text-ink-2 flex items-center justify-between hover:bg-line-2"
        >
          <span>
            {lowItems.length > 0 ? `${lowItems.length} out-of-stock / low items (incl. ground chicken)` : 'More tools & stock alerts'}
          </span>
          <span className="flex items-center gap-1">
            {showMore ? 'Hide details' : 'Show stock alerts & shortcuts'}
            {showMore ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </span>
        </button>

        {showMore && (
          <Card className="p-4 mt-2 space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => modals.openAddInv(null)}>
                <Plus size={14} /> Add inventory item
              </Button>
              <Button size="sm" variant="secondary" onClick={() => nav('/planner')}>
                Weekly Meal Planner
              </Button>
              <Button size="sm" variant="secondary" onClick={() => nav('/budget')}>
                Store Prices & Budget ({money(state.prefs.defaultBudget)})
              </Button>
            </div>
            {lowItems.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-line">
                <div className="text-xs font-semibold text-amber-800 flex items-center gap-1">
                  <AlertTriangle size={13} /> Running low / Out of stock
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {lowItems.map((i) => (
                    <div key={i.id} className="flex items-center justify-between text-xs bg-amber-soft/70 rounded-xl px-3 py-1.5">
                      <span className="font-medium">{i.name}</span>
                      <span className="text-amber-900">{i.outOfStock ? 'Out of stock' : fmtQU(i.quantity, i.unit)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
