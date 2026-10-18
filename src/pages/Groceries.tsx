import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useStore } from '../lib/store';
import { useModals } from '../components/modals';
import { buildGroceryItems, listTotal } from '../lib/engine';
import { fmtQU, money, stepFor, ALL_UNITS } from '../lib/units';
import { addDays, todayISO, uid } from '../lib/dates';
import type { GroceryCategory, GroceryItem, Unit } from '../types';
import { Badge, Button, Card, Chips, Empty, Field, IconButton, Input, Modal, PageHeader, Select, Stat, Stepper, toast } from '../components/ui';
import { Check, Download, Plus, Printer, ShoppingBag, ShoppingCart, Trash2, CheckCircle2 } from 'lucide-react';

const CAT_ORDER: GroceryCategory[] = [
  'protein', 'dairy', 'vegetables', 'fruits', 'grains', 'legumes', 'sauces', 'spices', 'oils', 'snacks', 'drinks', 'water', 'frozen', 'household', 'other',
];

const CAT_LABEL: Record<GroceryCategory, string> = {
  protein: '🥩 Meat & protein',
  dairy: '🥚 Dairy & eggs',
  vegetables: '🥦 Vegetables',
  fruits: '🍐 Fruits',
  grains: '🍞 Grains & bread',
  legumes: '🫘 Beans & legumes',
  sauces: '🫙 Sauces & condiments',
  spices: '🌶️ Spices',
  oils: '🫒 Oils & cooking',
  snacks: '🥨 Snacks',
  drinks: '☕ Drinks',
  water: '💧 Water bottles',
  frozen: '❄️ Frozen',
  household: '🧻 Household extras',
  other: '📦 Other',
};

export function GroceriesPage() {
  const state = useStore();
  const modals = useModals();
  const [params, setParams] = useSearchParams();
  const tripId = params.get('trip');
  const activeTrip = state.trips.find((t) => t.id === tripId) ?? state.trips.find((t) => t.status === 'shopping');

  const [storeFilter, setStoreFilter] = useState<string>('all');
  const [newName, setNewName] = useState('');
  const [newQty, setNewQty] = useState('1');
  const [newUnit, setNewUnit] = useState<Unit>('each');
  const [newCat, setNewCat] = useState<GroceryCategory>('protein');
  const [newPrice, setNewPrice] = useState('3.50');
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const items = activeTrip ? activeTrip.list.items : state.groceryDraft.items;

  const setItems = (next: GroceryItem[]) => {
    if (activeTrip) {
      state.saveTrip({ ...activeTrip, list: { ...activeTrip.list, items: next }, estimatedTotal: listTotal(next) });
    } else {
      state.setDraftItems(next);
    }
  };

  const quickGenerateFromPlan = (days: number) => {
    const start = todayISO();
    const end = addDays(start, days);
    const planned = state.plan.entries.filter((e) => e.date >= start && e.date < end && e.status === 'planned' && e.recipeId);
    const map = new Map<string, number>();
    for (const e of planned) map.set(e.recipeId!, (map.get(e.recipeId!) ?? 0) + e.servings);
    const selections = map.size
      ? [...map.entries()].map(([recipeId, servings]) => ({ recipeId, servings }))
      : state.recipes.filter((r) => r.frequent).slice(0, Math.min(days, 6)).map((r) => ({ recipeId: r.id, servings: r.servings }));
    const built = buildGroceryItems(state, selections, { includeLowStock: true });
    setItems(built);
    toast(`Generated consolidated list for ${days} days (subtracted current inventory)`);
  };

  const visible = useMemo(
    () => items.filter((i) => !i.removed && (storeFilter === 'all' || i.storeId === storeFilter)),
    [items, storeFilter],
  );

  const grouped = useMemo(() => {
    const m = new Map<GroceryCategory, GroceryItem[]>();
    for (const c of CAT_ORDER) m.set(c, []);
    for (const it of visible) m.get(it.category ?? 'other')?.push(it);
    return [...m.entries()].filter(([, arr]) => arr.length > 0);
  }, [visible]);

  const estTotal = listTotal(visible);
  const runningCheckedTotal = visible
    .filter((i) => i.checked && !i.alreadyHave)
    .reduce((s, i) => s + (i.actualPrice ?? i.estPrice ?? 0), 0);

  const addManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const item: GroceryItem = {
      id: uid('gi-'),
      name: newName.trim(),
      category: newCat,
      quantity: Number(newQty) || 1,
      unit: newUnit,
      estPrice: Number(newPrice) || 0,
      priceSource: 'manual',
      reason: 'manual',
      essential: false,
      checked: false,
      storeId: storeFilter === 'all' ? state.stores[0]?.id : storeFilter,
    };
    setItems([...items, item]);
    setNewName('');
    toast(`Added ${item.name} to list`);
  };

  const downloadListText = () => {
    const lines = visible
      .filter((i) => !i.alreadyHave)
      .map((i) => `[${i.checked ? 'x' : ' '}] ${i.name} — ${fmtQU(i.quantity, i.unit)} (~${money(i.estPrice)})`);
    const blob = new Blob([`Pink Kitchen Grocery List\nEstimated Total: ${money(estTotal)}\n\n` + lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `grocery-list-${todayISO()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={activeTrip ? `Shopping Mode: ${state.stores.find((s) => s.id === activeTrip.storeId)?.name ?? 'Store'}` : 'Smart Grocery List'}
        subtitle="Consolidates recipe ingredients, subtracts known stock, and flags unknown quantities for verification."
        actions={
          <div className="flex flex-wrap gap-2 no-print">
            <Button variant="secondary" onClick={downloadListText}><Download size={15} /> Download</Button>
            <Button variant="secondary" onClick={() => window.print()}><Printer size={15} /> Print</Button>
            <Button variant="primary" onClick={() => modals.openTrip()}>
              <ShoppingBag size={16} /> Plan a grocery trip (with budget)
            </Button>
          </div>
        }
      />

      {/* Quick period generator & store filter */}
      <div className="flex flex-wrap items-center justify-between gap-2 no-print">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-ink-3 mr-1">Quick build from plan:</span>
          {[3, 5, 7].map((d) => (
            <Button key={d} size="sm" variant="secondary" onClick={() => quickGenerateFromPlan(d)}>
              {d} days
            </Button>
          ))}
        </div>
        <Chips
          options={[
            { value: 'all', label: 'All stores' },
            ...state.stores.map((s) => ({ value: s.id, label: s.name })),
          ]}
          value={storeFilter}
          onChange={setStoreFilter}
        />
      </div>

      {/* Live Shopping Mode Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat
          label="Trip Budget"
          value={activeTrip ? money(activeTrip.budget.amount) : money(state.prefs.defaultBudget)}
          sub={activeTrip ? (activeTrip.budget.strict ? 'Strict cap' : 'Flexible') : 'Default'}
        />
        <Stat label="Estimated Total" value={money(estTotal)} sub={`${visible.filter((i) => !i.alreadyHave).length} items to buy`} tone="green" />
        <Stat label="In Cart (Checked)" value={money(runningCheckedTotal)} sub={`${visible.filter((i) => i.checked).length} checked off`} tone="blue" />
        <div className="flex items-center">
          <Button
            variant="primary"
            size="lg"
            className="w-full h-full"
            disabled={visible.length === 0}
            onClick={() => setCheckoutOpen(true)}
          >
            <CheckCircle2 size={18} /> Checkout & Restock
          </Button>
        </div>
      </div>

      {/* Manual add bar */}
      <Card className="p-3.5 no-print">
        <form onSubmit={addManual} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
          <div className="sm:col-span-4">
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Add item manually (e.g. Broccoli, Paper towels)..." />
          </div>
          <div className="sm:col-span-2">
            <Select value={newCat} onChange={(e) => setNewCat(e.target.value as GroceryCategory)}>
              {CAT_ORDER.map((c) => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Input type="number" step="any" value={newQty} onChange={(e) => setNewQty(e.target.value)} placeholder="Qty" />
          </div>
          <div className="sm:col-span-2">
            <Select value={newUnit} onChange={(e) => setNewUnit(e.target.value as Unit)}>
              {ALL_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </Select>
          </div>
          <div className="sm:col-span-1">
            <Input type="number" step="0.01" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} placeholder="$" />
          </div>
          <div className="sm:col-span-1">
            <Button type="submit" variant="soft" className="w-full"><Plus size={16} /></Button>
          </div>
        </form>
      </Card>

      {/* Categorized shopping list with mobile-friendly large checkboxes */}
      {grouped.length === 0 ? (
        <Empty
          icon={<ShoppingCart size={22} />}
          title="Your grocery list is empty"
        >
          Click <strong>Plan a grocery trip</strong> above or pick <strong>3 / 5 / 7 days</strong> to build a list from your recipes and current inventory.
        </Empty>
      ) : (
        <div className="space-y-4">
          {grouped.map(([cat, arr]) => (
            <Card key={cat} className="overflow-hidden">
              <div className="px-4 py-2.5 bg-canvas border-b border-line flex items-center justify-between">
                <span className="font-semibold text-sm">{CAT_LABEL[cat]}</span>
                <span className="text-xs text-ink-3">{arr.length} {arr.length === 1 ? 'item' : 'items'}</span>
              </div>
              <div className="divide-y divide-line">
                {arr.map((item) => {
                  const step = stepFor(item.unit);
                  return (
                    <div
                      key={item.id}
                      className={`px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${item.checked ? 'bg-brand-50/40' : ''}`}
                    >
                      <label className="flex items-start gap-3 cursor-pointer flex-1 min-w-0">
                        <input
                          type="checkbox"
                          checked={item.checked}
                          onChange={() =>
                            setItems(items.map((x) => (x.id === item.id ? { ...x, checked: !x.checked } : x)))
                          }
                          className="w-6 h-6 mt-0.5 rounded-lg accent-brand-600 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`font-semibold text-base ${item.checked || item.alreadyHave ? 'line-through text-ink-3' : ''}`}>
                              {item.name}
                            </span>
                            {item.verify && <Badge tone="amber">Verify kitchen stock</Badge>}
                            {item.alreadyHave && <Badge tone="green">Already at home</Badge>}
                            <Badge tone="outline">
                              {item.priceSource === 'verified' ? 'Verified' : item.priceSource === 'manual' ? 'Manual' : 'Est.'}
                            </Badge>
                          </div>
                          <div className="text-xs text-ink-3 mt-0.5">
                            {item.forRecipes?.length ? `For: ${item.forRecipes.join(', ')}` : item.reason === 'low-stock' ? 'Low-stock restock' : 'Manual addition'}
                          </div>
                        </div>
                      </label>

                      <div className="flex flex-wrap items-center gap-2 sm:justify-end no-print">
                        <Select
                          value={item.storeId ?? ''}
                          onChange={(e) => setItems(items.map((x) => (x.id === item.id ? { ...x, storeId: e.target.value } : x)))}
                          className="!w-32 !py-1 !px-2 !text-xs"
                        >
                          <option value="">Any store</option>
                          {state.stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </Select>

                        <Stepper
                          value={fmtQU(item.quantity, item.unit)}
                          onDec={() => setItems(items.map((x) => (x.id === item.id ? { ...x, quantity: Math.max(step, x.quantity - step) } : x)))}
                          onInc={() => setItems(items.map((x) => (x.id === item.id ? { ...x, quantity: x.quantity + step } : x)))}
                        />

                        <div className="flex items-center gap-1">
                          <span className="text-xs text-ink-3">$</span>
                          <Input
                            type="number"
                            step="0.01"
                            value={item.actualPrice ?? item.estPrice}
                            onChange={(e) =>
                              setItems(items.map((x) => (x.id === item.id ? { ...x, actualPrice: Number(e.target.value), estPrice: Number(e.target.value), priceSource: 'manual' } : x)))
                            }
                            className="!w-20 !py-1 !px-2 text-xs text-right"
                          />
                        </div>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setItems(items.map((x) => (x.id === item.id ? { ...x, alreadyHave: !x.alreadyHave } : x)))}
                        >
                          {item.alreadyHave ? 'Need to buy' : 'Have it'}
                        </Button>
                        <IconButton
                          label="Remove from list"
                          onClick={() => setItems(items.map((x) => (x.id === item.id ? { ...x, removed: true } : x)))}
                        >
                          <Trash2 size={15} />
                        </IconButton>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Checkout & Automatic Restock Modal */}
      {checkoutOpen && (
        <CheckoutRestockModal
          items={visible.filter((i) => !i.alreadyHave)}
          defaultTotal={runningCheckedTotal > 0 ? runningCheckedTotal : estTotal}
          onClose={() => setCheckoutOpen(false)}
          onConfirm={(actualTotal, confirmedItems) => {
            if (activeTrip) {
              state.completeTrip(activeTrip.id, actualTotal, confirmedItems);
              setParams({});
            } else {
              state.restockItems(confirmedItems, state.stores[0]?.id);
              state.setDraftItems([]);
            }
            setCheckoutOpen(false);
            toast(`Restocked ${confirmedItems.length} items into your kitchen inventory!`);
          }}
        />
      )}
    </div>
  );
}

function CheckoutRestockModal({
  items,
  defaultTotal,
  onClose,
  onConfirm,
}: {
  items: GroceryItem[];
  defaultTotal: number;
  onClose: () => void;
  onConfirm: (actualTotal: number, confirmed: GroceryItem[]) => void;
}) {
  const [actualTotal, setActualTotal] = useState(defaultTotal.toFixed(2));
  const [rows, setRows] = useState<GroceryItem[]>(() =>
    items.map((i) => ({ ...i, checked: items.some((x) => x.checked) ? i.checked : true, purchasedQty: i.quantity })),
  );

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title="Checkout & Confirm Purchased Quantities"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Back to shopping</Button>
          <Button
            variant="primary"
            onClick={() => onConfirm(Number(actualTotal) || 0, rows.filter((r) => r.checked))}
          >
            <Check size={16} /> Confirm & Auto-Restock Kitchen
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Actual receipt total at checkout ($)" hint="Tracked against your estimated total & trip budget">
          <Input type="number" step="0.01" value={actualTotal} onChange={(e) => setActualTotal(e.target.value)} />
        </Field>
        <div className="text-xs text-ink-3">
          Confirm the exact quantities you purchased. Only checked items below will be added to your kitchen inventory (no double-counting).
        </div>
        <div className="max-h-72 overflow-y-auto divide-y divide-line border border-line rounded-2xl">
          {rows.map((r) => (
            <div key={r.id} className="px-3.5 py-2.5 flex items-center justify-between gap-2 text-sm">
              <label className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={r.checked}
                  onChange={() => setRows(rows.map((x) => (x.id === r.id ? { ...x, checked: !x.checked } : x)))}
                />
                <span className="font-medium">{r.name}</span>
              </label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  step="any"
                  value={r.purchasedQty ?? r.quantity}
                  onChange={(e) => setRows(rows.map((x) => (x.id === r.id ? { ...x, purchasedQty: Number(e.target.value) } : x)))}
                  className="!w-20 !py-1 !px-2 text-xs text-right"
                />
                <span className="text-xs text-ink-3 w-14">{r.unit}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
