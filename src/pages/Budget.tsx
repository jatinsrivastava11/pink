import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../lib/store';
import { useModals } from '../components/modals';
import { unitPrice } from '../lib/engine';
import { fmtQU, money, ALL_UNITS } from '../lib/units';
import { fmtDate, todayISO } from '../lib/dates';
import type { PriceSource, Unit } from '../types';
import { Badge, Button, Card, CardHeader, Empty, Field, IconButton, Input, PageHeader, Select, Stat, toast } from '../components/ui';
import { Plus, ShoppingBag, Store as StoreIcon, Trash2, Wallet } from 'lucide-react';

export function BudgetPage() {
  const state = useStore();
  const modals = useModals();

  const [storeName, setStoreName] = useState('');
  const [priceIngId, setPriceIngId] = useState(state.ingredients[0]?.id ?? 'chicken-breast');
  const [priceStoreId, setPriceStoreId] = useState(state.stores[0]?.id ?? 'traderjoes');
  const [priceVal, setPriceVal] = useState('5.99');
  const [pkgQty, setPkgQty] = useState('1');
  const [pkgUnit, setPkgUnit] = useState<Unit>('lb');
  const [priceSource, setPriceSource] = useState<PriceSource>('verified');
  const [searchPrice, setSearchPrice] = useState('');

  const completed = state.trips.filter((t) => t.status === 'completed');
  const totalBudgeted = completed.reduce((s, t) => s + t.budget.amount, 0);
  const totalEstimated = completed.reduce((s, t) => s + t.estimatedTotal, 0);
  const totalActual = completed.reduce((s, t) => s + (t.actualTotal ?? t.estimatedTotal), 0);

  const savePriceRecord = (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(priceVal);
    if (!num) return;
    state.setPrice({
      ingredientId: priceIngId,
      storeId: priceStoreId,
      price: num,
      packageQty: Number(pkgQty) || 1,
      packageUnit: pkgUnit,
      source: priceSource,
      checkedAt: todayISO(),
    });
    state.updateIngredient(priceIngId, {
      packagePrice: num,
      packageQty: Number(pkgQty) || 1,
      packageUnit: pkgUnit,
      priceSource,
      priceCheckedAt: todayISO(),
      preferredStoreId: priceStoreId,
    });
    toast('Saved store price');
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Grocery Budget, Stores & Price Book"
        subtitle="Transparent price tracking — estimated prices are clearly distinguished from your manual or receipt-verified store prices."
        actions={
          <Button variant="primary" onClick={() => modals.openTrip()}>
            <ShoppingBag size={16} /> Plan a grocery trip
          </Button>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Default Trip Budget" value={money(state.prefs.defaultBudget)} sub="Always asked before each trip" />
        <Stat label="Completed Trips" value={completed.length} sub={`${state.trips.filter((t) => t.status === 'shopping').length} active`} />
        <Stat label="Estimated Spend (All)" value={money(totalEstimated)} sub={`Budgeted: ${money(totalBudgeted)}`} />
        <Stat
          label="Actual Spend (All)"
          value={money(totalActual)}
          sub={totalBudgeted > 0 ? `Remaining vs budget: ${money(totalBudgeted - totalActual)}` : 'From checkout receipts'}
          tone={totalActual <= totalBudgeted ? 'green' : 'amber'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Trip history & Stores */}
        <div className="lg:col-span-6 space-y-5">
          <Card className="p-5">
            <CardHeader
              title="Grocery Trip History"
              subtitle="Budget vs. Estimated vs. Actual checkout spending"
              icon={<Wallet size={18} />}
            />
            {state.trips.length === 0 ? (
              <Empty title="No grocery trips logged yet">
                Click <strong>Plan a grocery trip</strong> to set your trip budget and generate a store list.
              </Empty>
            ) : (
              <div className="space-y-2.5">
                {[...state.trips].reverse().map((t) => {
                  const st = state.stores.find((s) => s.id === t.storeId);
                  const rem = t.budget.amount - (t.actualTotal ?? t.estimatedTotal);
                  return (
                    <div key={t.id} className="rounded-2xl border border-line p-3.5 flex items-center justify-between gap-3 text-sm">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{st?.name ?? 'Store'}</span>
                          <Badge tone={t.status === 'completed' ? 'green' : 'blue'}>{t.status}</Badge>
                          <span className="text-xs text-ink-3">{fmtDate(t.createdAt.slice(0, 10))}</span>
                        </div>
                        <div className="text-xs text-ink-3 mt-1">
                          Budget: <strong>{money(t.budget.amount)}</strong> · Est: <strong>{money(t.estimatedTotal)}</strong>
                          {t.actualTotal != null && <> · Actual: <strong>{money(t.actualTotal)}</strong></>}
                          {' · '}Remaining: <strong className={rem >= 0 ? 'text-brand-700' : 'text-red-700'}>{money(rem)}</strong>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {t.status === 'shopping' && (
                          <Link to={`/groceries?trip=${t.id}`}>
                            <Button size="sm" variant="soft">Open</Button>
                          </Link>
                        )}
                        <IconButton label="Delete trip" onClick={() => state.removeTrip(t.id)}><Trash2 size={15} /></IconButton>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card className="p-5 space-y-3">
            <CardHeader title="Your Shopping Stores" subtitle="Trader Joe's, Walmart, Target + any custom store" icon={<StoreIcon size={18} />} />
            <div className="flex flex-wrap gap-2">
              {state.stores.map((s) => (
                <div key={s.id} className="inline-flex items-center gap-2 rounded-xl border border-line px-3 py-1.5 text-sm bg-white">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
                  <span className="font-medium">{s.name}</span>
                  {state.stores.length > 1 && (
                    <button onClick={() => state.removeStore(s.id)} className="text-ink-3 hover:text-red-600 text-xs">×</button>
                  )}
                </div>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!storeName.trim()) return;
                state.addStore(storeName.trim());
                setStoreName('');
                toast('Store added');
              }}
              className="flex gap-2 pt-1"
            >
              <Input value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="Add another store (e.g. Costco, Patel Brothers)..." />
              <Button type="submit" variant="secondary"><Plus size={15} /> Add</Button>
            </form>
          </Card>
        </div>

        {/* Store Price Book */}
        <Card className="lg:col-span-6 p-5 space-y-4">
          <CardHeader
            title="Store Price Book & Preferred Store Assignment"
            subtitle="Record real prices from receipts — never confuses estimates with verified prices"
          />
          <form onSubmit={savePriceRecord} className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 bg-canvas p-3.5 rounded-2xl border border-line">
            <Field label="Ingredient" className="col-span-2 sm:col-span-1">
              <Select
                value={priceIngId}
                onChange={(e) => {
                  setPriceIngId(e.target.value);
                  const ing = state.ingredients.find((x) => x.id === e.target.value);
                  if (ing) {
                    setPkgQty(String(ing.packageQty ?? 1));
                    setPkgUnit(ing.packageUnit ?? ing.defaultUnit);
                    setPriceVal(String(ing.packagePrice ?? 3));
                  }
                }}
              >
                {state.ingredients.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </Select>
            </Field>
            <Field label="Store">
              <Select value={priceStoreId} onChange={(e) => setPriceStoreId(e.target.value)}>
                {state.stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </Field>
            <Field label="Package price ($)">
              <Input type="number" step="0.01" value={priceVal} onChange={(e) => setPriceVal(e.target.value)} />
            </Field>
            <Field label="Package size">
              <Input type="number" step="any" value={pkgQty} onChange={(e) => setPkgQty(e.target.value)} />
            </Field>
            <Field label="Unit">
              <Select value={pkgUnit} onChange={(e) => setPkgUnit(e.target.value as Unit)}>
                {ALL_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </Select>
            </Field>
            <Field label="Price type">
              <Select value={priceSource} onChange={(e) => setPriceSource(e.target.value as PriceSource)}>
                <option value="verified">Verified receipt</option>
                <option value="manual">Manual entry</option>
                <option value="estimate">Estimate</option>
              </Select>
            </Field>
            <div className="col-span-2 sm:col-span-3 flex justify-end">
              <Button type="submit" variant="primary" size="sm">Save store price</Button>
            </div>
          </form>

          <Input value={searchPrice} onChange={(e) => setSearchPrice(e.target.value)} placeholder="Filter ingredients..." />

          <div className="max-h-80 overflow-y-auto divide-y divide-line border border-line rounded-2xl text-xs">
            {state.ingredients
              .filter((i) => !i.staple && i.name.toLowerCase().includes(searchPrice.toLowerCase()))
              .map((ing) => {
                const p = unitPrice(state, ing);
                const store = state.stores.find((s) => s.id === ing.preferredStoreId);
                return (
                  <div key={ing.id} className="px-3.5 py-2.5 flex items-center justify-between gap-2">
                    <div>
                      <span className="font-semibold text-sm">{ing.name}</span>
                      <div className="text-ink-3">
                        Package: {fmtQU(p.pkgQty ?? 1, p.pkgUnit ?? ing.defaultUnit)} · Checked {ing.priceCheckedAt ?? '—'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select
                        value={ing.preferredStoreId ?? ''}
                        onChange={(e) => state.updateIngredient(ing.id, { preferredStoreId: e.target.value || undefined })}
                        className="!w-32 !py-1 !px-2 !text-xs"
                      >
                        <option value="">Any store</option>
                        {state.stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </Select>
                      <Badge tone={p.source === 'verified' ? 'green' : p.source === 'manual' ? 'blue' : 'outline'}>
                        {money(p.perPkg)} ({p.source})
                      </Badge>
                      {store && <span className="sr-only">{store.name}</span>}
                    </div>
                  </div>
                );
              })}
          </div>
        </Card>
      </div>
    </div>
  );
}
