import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useStore } from '../lib/store';
import { useModals } from '../components/modals';
import { isInStock, isLowStock } from '../lib/engine';
import { expiryState, daysUntil, todayISO, uid } from '../lib/dates';
import { fmtQU, stepFor, unitLabel } from '../lib/units';
import type { GroceryCategory, InventoryItem, PreparedMeal } from '../types';
import { Badge, Button, Card, Chips, Empty, Field, IconButton, Input, Modal, PageHeader, Select, Stat, Stepper, toast } from '../components/ui';
import { Copy, Edit2, Plus, Search, Trash2, Utensils, Droplets, PackageCheck, ArrowRightLeft } from 'lucide-react';

type Tab = 'all' | 'fridge' | 'freezer' | 'pantry' | 'prepared' | 'drinks' | 'other';

export function InventoryPage() {
  const state = useStore();
  const modals = useModals();
  const [params, setParams] = useSearchParams();
  const initialTab = (params.get('tab') as Tab) || 'all';

  const [tab, setTab] = useState<Tab>(initialTab);
  const [q, setQ] = useState('');
  const [catFilter, setCatFilter] = useState<string>('all');
  const [expFilter, setExpFilter] = useState<'all' | 'expiring' | 'low' | 'unknown'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'expiry' | 'qty'>('name');
  const [selected, setSelected] = useState<string[]>([]);
  const [inlineEditId, setInlineEditId] = useState<string | null>(null);
  const [inlineVal, setInlineVal] = useState<string>('');
  const [addPrepOpen, setAddPrepOpen] = useState(false);
  const [hideSpices, setHideSpices] = useState(true);

  // Summary metrics
  const stockedCount = state.inventory.filter(isInStock).length;
  const lowCount = state.inventory.filter(isLowStock).length;
  const outCount = state.inventory.filter((i) => i.outOfStock || i.quantity === 0).length;
  const expiringCount = state.inventory.filter((i) => {
    const s = expiryState(i.expirationDate);
    return isInStock(i) && (s === 'expired' || s === 'today' || s === 'soon3' || s === 'soon7');
  }).length;
  const preparedTotal = state.prepared.reduce((s, p) => s + p.servings, 0);
  const waterItem = state.inventory.find((i) => i.category === 'water' && i.unit === 'bottle');
  const waterCount = waterItem?.quantity;

  const filtered = useMemo(() => {
    return state.inventory
      .filter((i) => {
        if (tab !== 'all' && tab !== 'prepared' && i.location !== tab) return false;
        if (hideSpices && catFilter === 'all' && !q && i.category === 'spices') return false;
        if (catFilter !== 'all' && i.category !== catFilter) return false;
        if (q && !i.name.toLowerCase().includes(q.toLowerCase()) && !(i.notes ?? '').toLowerCase().includes(q.toLowerCase())) return false;
        if (expFilter === 'low' && !isLowStock(i)) return false;
        if (expFilter === 'unknown' && i.quantity !== null) return false;
        if (expFilter === 'expiring') {
          const s = expiryState(i.expirationDate);
          if (s === 'none' || s === 'ok') return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'expiry') return (a.expirationDate ?? '9999').localeCompare(b.expirationDate ?? '9999');
        if (sortBy === 'qty') return (a.quantity ?? -1) - (b.quantity ?? -1);
        return a.name.localeCompare(b.name);
      });
  }, [state.inventory, tab, catFilter, q, expFilter, sortBy, hideSpices]);

  const toggleSelect = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const addWaterPack = (pack: number, oz = 16.9) => {
    if (waterItem) {
      const next = (waterItem.quantity ?? 0) + pack;
      state.updateItem(waterItem.id, { quantity: next, bottleSizeOz: oz, outOfStock: false });
      toast(`Added ${pack} bottles (${oz} oz) → ${next} remaining`);
    } else {
      state.addItem({ ingredientId: 'water-bottle', name: 'Bottled water', category: 'water', location: 'drinks', quantity: pack, unit: 'bottle', bottleSizeOz: oz, minQuantity: 6 });
      toast(`Added ${pack} water bottles`);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Kitchen Inventory"
        subtitle="Instant + / − stock controls. Unknown quantities are never invented — tap any quantity to set or verify it."
        actions={
          <>
            <Button variant="secondary" onClick={() => setAddPrepOpen(true)}><Utensils size={15} /> + Prepared meal</Button>
            <Button variant="primary" onClick={() => modals.openAddInv(null)}><Plus size={16} /> Add item</Button>
          </>
        }
      />

      {/* Dashboard summary bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <Stat label="Stocked items" value={stockedCount} sub={`of ${state.inventory.length} tracked`} tone="green" />
        <Stat label="Low stock" value={lowCount} sub="Click filter below" tone={lowCount ? 'amber' : undefined} />
        <Stat label="Expiring soon" value={expiringCount} sub="Within 7 days" tone={expiringCount ? 'red' : undefined} />
        <Stat label="Out of stock" value={outCount} sub="Incl. ground chicken" tone={outCount ? 'amber' : undefined} />
        <Stat label="Prepared meals" value={`${preparedTotal} srv`} sub={`${state.prepared.filter((p) => p.servings > 0).length} dishes`} tone="green" />
        <Stat label="Water bottles" value={waterCount == null ? 'Not set' : `${waterCount}`} sub={`${waterItem?.bottleSizeOz ?? 16.9} oz bottles`} tone="blue" />
      </div>

      {/* Location section tabs */}
      <Chips
        options={[
          { value: 'all', label: 'All items', count: state.inventory.length },
          { value: 'fridge', label: '🧊 Fridge', count: state.inventory.filter((i) => i.location === 'fridge').length },
          { value: 'freezer', label: '❄️ Freezer', count: state.inventory.filter((i) => i.location === 'freezer').length },
          { value: 'pantry', label: '🥫 Pantry', count: state.inventory.filter((i) => i.location === 'pantry').length },
          { value: 'prepared', label: '🍱 Prepared meals', count: preparedTotal },
          { value: 'drinks', label: '💧 Drinks & water', count: state.inventory.filter((i) => i.location === 'drinks').length },
          { value: 'other', label: '📦 Other storage', count: state.inventory.filter((i) => i.location === 'other').length },
        ]}
        value={tab}
        onChange={(v) => { setTab(v); setParams(v === 'all' ? {} : { tab: v }); }}
      />

      {/* Dedicated Water Bottle Quick Bar when on Drinks or All */}
      {(tab === 'drinks' || tab === 'all') && (
        <Card className="p-4 bg-sky-soft/60 border-sky-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white text-sky-700 flex items-center justify-center shrink-0">
              <Droplets size={20} />
            </div>
            <div>
              <div className="font-semibold text-sm">
                Water Bottle Stock: {waterCount == null ? 'Quantity not specified' : `${waterCount} bottles remaining`} ({waterItem?.bottleSizeOz ?? 16.9} oz)
              </div>
              <div className="text-xs text-ink-2">
                Add cases or subtract consumed bottles directly (separate from your daily hydration log).
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Button size="sm" variant="secondary" onClick={() => addWaterPack(24, 16.9)}>+24 case (16.9 oz)</Button>
            <Button size="sm" variant="secondary" onClick={() => addWaterPack(12, 16.9)}>+12 pack</Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                if (!waterItem) return;
                const next = Math.max(0, (waterItem.quantity ?? 2) - 2);
                state.setQty(waterItem.id, next);
                toast(`Consumed 2 bottles → ${next} remaining`);
              }}
            >
              −2 bottles
            </Button>
            {waterItem && (
              <Stepper
                value={waterCount == null ? 'Set' : `${waterCount}`}
                onDec={() => state.setQty(waterItem.id, Math.max(0, (waterCount ?? 1) - 1))}
                onInc={() => state.setQty(waterItem.id, (waterCount ?? 0) + 1)}
              />
            )}
          </div>
        </Card>
      )}

      {/* Prepared Meals Section */}
      {(tab === 'prepared' || tab === 'all') && (
        <Card className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-base">Prepared Meals ({preparedTotal} servings ready)</h2>
              <p className="text-xs text-ink-3">Eating a prepared meal deducts 1 serving here without deducting raw ingredients again.</p>
            </div>
            <Button size="sm" variant="soft" onClick={() => setAddPrepOpen(true)}><Plus size={14} /> Add prepared meal</Button>
          </div>
          {state.prepared.length === 0 ? (
            <Empty title="No prepared meals tracked" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {state.prepared.map((p) => {
                const exp = expiryState(p.expirationDate);
                return (
                  <div key={p.id} className="rounded-2xl border border-line p-3.5 flex flex-col justify-between gap-3 bg-brand-50/30">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-sm">🍱 {p.name}</span>
                        <div className="flex items-center gap-1.5">
                          <Badge tone={p.servings > 0 ? 'green' : 'amber'}>{p.servings} servings</Badge>
                          <Select
                            className="!py-0.5 !px-2 !text-xs !w-28"
                            value={p.location}
                            onChange={(e) => state.savePrepared({ ...p, location: e.target.value })}
                          >
                            <option value="fridge">Fridge</option>
                            <option value="freezer">Freezer</option>
                          </Select>
                        </div>
                      </div>
                      {p.nutrition && (
                        <div className="text-xs text-ink-2 mt-1">
                          Est. {p.nutrition.kcal} kcal · <strong>{p.nutrition.protein}g P</strong> · {p.nutrition.carbs}g C · {p.nutrition.fat}g F
                        </div>
                      )}
                      {p.expirationDate && (
                        <div className="mt-1">
                          <ExpiryBadge date={p.expirationDate} state={exp} />
                        </div>
                      )}
                      {p.notes && <div className="text-[11px] text-ink-3 mt-1">{p.notes}</div>}
                      {p.reheating && <div className="text-[11px] text-brand-800 mt-1"><strong>Reheat:</strong> {p.reheating}</div>}
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-line-2">
                      <Stepper
                        value={`${p.servings} srv`}
                        onDec={() => state.savePrepared({ ...p, servings: Math.max(0, p.servings - 1) })}
                        onInc={() => state.savePrepared({ ...p, servings: p.servings + 1 })}
                      />
                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          variant="primary"
                          disabled={p.servings <= 0}
                          onClick={() => {
                            state.eatPrepared(p.id, 1, 'any');
                            toast(`Ate 1 ${p.name} (${p.servings - 1} remaining)`);
                          }}
                        >
                          <Utensils size={14} /> Eat 1 serving
                        </Button>
                        <IconButton label="Delete prepared meal" onClick={() => state.removePrepared(p.id)}>
                          <Trash2 size={15} />
                        </IconButton>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* Search, filter, sort & bulk toolbar for raw/packaged inventory */}
      {tab !== 'prepared' && (
        <>
          <div className="flex flex-col md:flex-row gap-2.5 items-stretch md:items-center justify-between">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search ingredients, spices, drinks..." className="!pl-9" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className="!w-40">
                <option value="all">All categories</option>
                {(['protein', 'dairy', 'vegetables', 'fruits', 'grains', 'legumes', 'sauces', 'spices', 'oils', 'snacks', 'drinks', 'water', 'frozen', 'household'] as GroceryCategory[]).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
              <Select value={expFilter} onChange={(e) => setExpFilter(e.target.value as any)} className="!w-44">
                <option value="all">All stock states</option>
                <option value="low">Low / Out of stock</option>
                <option value="expiring">Expiring within 7d</option>
                <option value="unknown">Qty not specified</option>
              </Select>
              <Select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="!w-40">
                <option value="name">Sort: Name</option>
                <option value="expiry">Sort: Expiration</option>
                <option value="qty">Sort: Quantity</option>
              </Select>
              <Button
                size="sm"
                variant={hideSpices ? 'secondary' : 'soft'}
                onClick={() => setHideSpices(!hideSpices)}
              >
                {hideSpices ? 'Show 21 spices' : 'Hide spices'}
              </Button>
            </div>
          </div>

          {/* Bulk update bar when items are checked */}
          {selected.length > 0 && (
            <div className="rounded-2xl bg-ink text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span><strong>{selected.length}</strong> items selected</span>
              <div className="flex flex-wrap gap-1.5">
                {state.locations.map((l) => (
                  <Button
                    key={l.id}
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      state.bulkUpdate(selected, { location: l.id });
                      toast(`Moved ${selected.length} items to ${l.name}`);
                      setSelected([]);
                    }}
                  >
                    Move → {l.name}
                  </Button>
                ))}
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => {
                    state.bulkUpdate(selected, { outOfStock: true, quantity: 0 });
                    setSelected([]);
                  }}
                >
                  Mark out of stock
                </Button>
                <Button size="sm" variant="ghost" className="!text-white" onClick={() => setSelected([])}>Clear</Button>
              </div>
            </div>
          )}

          {/* Inventory list */}
          <Card className="divide-y divide-line overflow-hidden">
            {filtered.length === 0 ? (
              <Empty title="No matching inventory items" />
            ) : (
              filtered.map((item) => {
                const step = stepFor(item.unit);
                const exp = expiryState(item.expirationDate);
                const low = isLowStock(item);
                const isEditing = inlineEditId === item.id;
                return (
                  <div key={item.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-canvas/50 transition">
                    <div className="flex items-start gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={selected.includes(item.id)}
                        onChange={() => toggleSelect(item.id)}
                        className="mt-1 rounded border-line"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`font-semibold text-sm ${item.outOfStock ? 'line-through text-ink-3' : ''}`}>{item.name}</span>
                          <Badge tone="neutral" className="capitalize">{item.category}</Badge>
                          {item.outOfStock && <Badge tone="red">Out of stock</Badge>}
                          {!item.outOfStock && low && <Badge tone="amber">Low stock</Badge>}
                          {item.quantity === null && !item.outOfStock && <Badge tone="outline">Qty not specified</Badge>}
                          {item.expirationDate && <ExpiryBadge date={item.expirationDate} state={exp} />}
                        </div>
                        {item.notes && <div className="text-xs text-ink-3 mt-0.5">{item.notes}</div>}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      {/* Quick location switcher */}
                      <Select
                        aria-label={`Location for ${item.name}`}
                        value={item.location}
                        onChange={(e) => state.updateItem(item.id, { location: e.target.value })}
                        className="!w-32 !py-1 !px-2 !text-xs"
                      >
                        {state.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                      </Select>

                      {/* Quantity stepper or inline input */}
                      {isEditing ? (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            const v = inlineVal.trim() === '' ? null : Number(inlineVal);
                            state.setQty(item.id, v);
                            setInlineEditId(null);
                          }}
                          className="flex items-center gap-1"
                        >
                          <Input
                            autoFocus
                            type="number"
                            step="any"
                            value={inlineVal}
                            onChange={(e) => setInlineVal(e.target.value)}
                            className="!w-20 !py-1 !px-2 text-xs"
                            placeholder="Qty"
                          />
                          <Button size="sm" variant="primary" type="submit">Set</Button>
                        </form>
                      ) : (
                        <Stepper
                          label={item.name}
                          value={item.outOfStock ? `0 ${unitLabel(item.unit, 0)}` : fmtQU(item.quantity, item.unit)}
                          onEdit={() => {
                            setInlineEditId(item.id);
                            setInlineVal(item.quantity == null ? '' : String(item.quantity));
                          }}
                          onDec={() => {
                            if (item.quantity === null) {
                              state.setQty(item.id, 0);
                            } else {
                              state.adjustQty(item.id, -step);
                            }
                          }}
                          onInc={() => {
                            if (item.quantity === null) {
                              state.setQty(item.id, step);
                            } else {
                              state.adjustQty(item.id, step);
                            }
                          }}
                        />
                      )}

                      {/* Quick actions */}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => state.setOutOfStock(item.id, !item.outOfStock)}
                        title={item.outOfStock ? 'Mark back in stock' : 'Mark finished / out of stock'}
                      >
                        {item.outOfStock ? 'Restock' : 'Finished'}
                      </Button>
                      <IconButton label={`Edit ${item.name}`} onClick={() => modals.openAddInv(item)}>
                        <Edit2 size={15} />
                      </IconButton>
                      <IconButton label={`Duplicate ${item.name}`} onClick={() => { state.duplicateItem(item.id); toast(`Duplicated ${item.name}`); }}>
                        <Copy size={15} />
                      </IconButton>
                      <IconButton label={`Remove ${item.name}`} onClick={() => state.removeItem(item.id)}>
                        <Trash2 size={15} />
                      </IconButton>
                    </div>
                  </div>
                );
              })
            )}
          </Card>
        </>
      )}

      {/* Add Prepared Meal Modal */}
      <AddPreparedModal open={addPrepOpen} onClose={() => setAddPrepOpen(false)} />
    </div>
  );
}

function ExpiryBadge({ date, state }: { date: string; state: ReturnType<typeof expiryState> }) {
  const d = daysUntil(date);
  if (state === 'expired') return <Badge tone="red">Expired ({Math.abs(d)}d ago)</Badge>;
  if (state === 'today') return <Badge tone="red">Expires today</Badge>;
  if (state === 'soon3') return <Badge tone="amber">Expires in {d}d</Badge>;
  if (state === 'soon7') return <Badge tone="amber">Exp {date}</Badge>;
  return <Badge tone="outline">Exp {date}</Badge>;
}

function AddPreparedModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const savePrepared = useStore((s) => s.savePrepared);
  const [name, setName] = useState('');
  const [servings, setServings] = useState(2);
  const [location, setLocation] = useState('fridge');
  const [kcal, setKcal] = useState('450');
  const [protein, setProtein] = useState('35');
  const [exp, setExp] = useState('');
  const [notes, setNotes] = useState('');

  if (!open) return null;
  const save = () => {
    if (!name.trim()) return;
    savePrepared({
      id: uid('prep-'),
      name: name.trim(),
      servings,
      location,
      preparedDate: todayISO(),
      expirationDate: exp || undefined,
      nutrition: { kcal: Number(kcal) || 0, protein: Number(protein) || 0, carbs: 30, fat: 15, fiber: 4 },
      notes: notes || undefined,
      updatedAt: new Date().toISOString(),
    });
    toast(`Added ${servings} servings of ${name}`);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Track a Prepared Meal"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save}>Save prepared meal</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Meal name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Prepped Chicken Tikka Portions" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Servings ready"><Input type="number" min={1} value={servings} onChange={(e) => setServings(Number(e.target.value))} /></Field>
          <Field label="Storage"><Select value={location} onChange={(e) => setLocation(e.target.value)}><option value="fridge">Fridge</option><option value="freezer">Freezer</option></Select></Field>
          <Field label="Est. kcal / serving"><Input type="number" value={kcal} onChange={(e) => setKcal(e.target.value)} /></Field>
          <Field label="Est. protein (g) / serving"><Input type="number" value={protein} onChange={(e) => setProtein(e.target.value)} /></Field>
          <Field label="Eat-by date (optional)"><Input type="date" value={exp} onChange={(e) => setExp(e.target.value)} /></Field>
        </div>
        <Field label="Notes / reheating"><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}
