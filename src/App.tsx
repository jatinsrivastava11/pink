import { HashRouter, NavLink, Route, Routes } from 'react-router-dom';
import {
  Calendar, Flame, HeartHandshake, Home, Package, Settings, ShoppingBag, ShoppingCart, Utensils, Wallet,
} from 'lucide-react';
import { useStore } from './lib/store';
import { isLowStock } from './lib/engine';
import { Toaster } from './components/ui';
import { AddEditInventoryModal, CookModal, OnboardingModal, PlanTripModal, SupportModal, WeightModal, useModals } from './components/modals';
import { DashboardPage } from './pages/Dashboard';
import { InventoryPage } from './pages/Inventory';
import { MealsPage } from './pages/Meals';
import { PlannerPage } from './pages/Planner';
import { GroceriesPage } from './pages/Groceries';
import { BudgetPage } from './pages/Budget';
import { NutritionPage } from './pages/Nutrition';
import { SettingsPage } from './pages/Settings';

const NAV = [
  { to: '/', label: 'Dashboard', icon: Home, end: true },
  { to: '/inventory', label: 'Inventory', icon: Package },
  { to: '/meals', label: 'Meals', icon: Utensils },
  { to: '/planner', label: 'Meal Planner', icon: Calendar },
  { to: '/groceries', label: 'Grocery List', icon: ShoppingCart },
  { to: '/budget', label: 'Budget', icon: Wallet },
  { to: '/nutrition', label: 'Nutrition', icon: Flame },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function App() {
  const lowCount = useStore((s) => s.inventory.filter(isLowStock).length);
  const preparedCount = useStore((s) => s.prepared.reduce((sum, p) => sum + p.servings, 0));
  const modals = useModals();

  return (
    <HashRouter>
      <div className="min-h-screen flex flex-col lg:flex-row">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex flex-col justify-between w-64 shrink-0 border-r border-line bg-surface px-4 py-6 sticky top-0 h-screen no-print">
          <div className="space-y-6">
            <div className="flex items-center gap-3 px-2">
              <div className="w-9 h-9 rounded-xl bg-brand-600 text-white flex items-center justify-center font-display text-lg font-semibold shadow-sm">
                P
              </div>
              <div>
                <div className="font-display text-lg leading-none">Pink Kitchen</div>
                <div className="text-[11px] text-ink-3 mt-0.5">Inventory · Meals · Groceries</div>
              </div>
            </div>

            <nav className="space-y-1">
              {NAV.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                        isActive ? 'bg-brand-600 text-white shadow-sm' : 'text-ink-2 hover:bg-line-2'
                      }`
                    }
                  >
                    <span className="flex items-center gap-3">
                      <Icon size={17} />
                      <span>{item.label}</span>
                    </span>
                    {item.to === '/inventory' && lowCount > 0 && (
                      <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-900">{lowCount}</span>
                    )}
                  </NavLink>
                );
              })}
            </nav>
          </div>

          <div className="space-y-2 pt-4 border-t border-line">
            <button
              type="button"
              onClick={() => modals.openTrip()}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand-600 text-white py-2.5 px-3 text-xs font-semibold hover:bg-brand-700 transition"
            >
              <ShoppingBag size={15} /> Plan Grocery Trip
            </button>
            <button
              type="button"
              onClick={modals.openSupport}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand-50 text-brand-800 border border-brand-100 py-2 px-3 text-xs font-medium hover:bg-brand-100 transition"
            >
              <HeartHandshake size={14} /> What do I need right now?
            </button>
            <div className="text-[11px] text-ink-3 text-center pt-1">
              {preparedCount} prepped meals ready · Local-first PWA
            </div>
          </div>
        </aside>

        {/* Mobile Top Bar */}
        <header className="lg:hidden sticky top-0 z-30 bg-surface/90 backdrop-blur border-b border-line px-4 py-2.5 flex items-center justify-between no-print">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-brand-600 text-white flex items-center justify-center font-display text-sm font-semibold">
              P
            </div>
            <span className="font-display text-base">Pink Kitchen</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={modals.openSupport}
              className="px-2.5 py-1.5 rounded-xl bg-brand-50 text-brand-700 text-xs font-medium flex items-center gap-1"
            >
              <HeartHandshake size={13} /> Need help?
            </button>
            <button
              onClick={() => modals.openTrip()}
              className="px-2.5 py-1.5 rounded-xl bg-brand-600 text-white text-xs font-medium flex items-center gap-1"
            >
              <ShoppingBag size={13} /> Shop
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-5 pb-nav max-w-7xl mx-auto w-full">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/meals" element={<MealsPage />} />
            <Route path="/planner" element={<PlannerPage />} />
            <Route path="/groceries" element={<GroceriesPage />} />
            <Route path="/budget" element={<BudgetPage />} />
            <Route path="/nutrition" element={<NutritionPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>

        {/* Mobile Bottom Navigation */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-surface/95 backdrop-blur border-t border-line safe-bottom no-print">
          <div className="grid grid-cols-8 gap-0.5 px-1 py-1.5">
            {NAV.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex flex-col items-center justify-center py-1 rounded-lg text-[10px] font-medium ${
                      isActive ? 'text-brand-700 bg-brand-50' : 'text-ink-3'
                    }`
                  }
                >
                  <Icon size={16} />
                  <span className="truncate max-w-full px-0.5 mt-0.5">{item.label.split(' ')[0]}</span>
                </NavLink>
              );
            })}
          </div>
        </nav>

        {/* Shared Interactive Modals */}
        <OnboardingModal />
        <CookModal />
        <SupportModal />
        <PlanTripModal />
        <AddEditInventoryModal />
        <WeightModal />
        <Toaster />
      </div>
    </HashRouter>
  );
}
