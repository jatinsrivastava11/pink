import { useState } from 'react';
import { useStore } from '../lib/store';
import { estimateMaintenance, suggestTarget } from '../lib/nutrition';
import { todayISO } from '../lib/dates';
import type { AppData, Cuisine } from '../types';
import { Button, Card, CardHeader, Field, Input, PageHeader, Select, Toggle, toast } from '../components/ui';
import { Download, RotateCcw, Upload, User, Database, FolderOpen } from 'lucide-react';

export function SettingsPage() {
  const state = useStore();
  const p = state.prefs;

  const [newLoc, setNewLoc] = useState('');
  const maint = estimateMaintenance(p);
  const suggested = suggestTarget(maint);

  const exportJson = () => {
    const data = state.exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pink-kitchen-backup-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Downloaded full JSON backup');
  };

  const importJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as AppData;
        state.importData(parsed);
        toast('Backup restored! Inventory, recipes, and plans are back.');
      } catch {
        toast('Invalid backup JSON file', 'err');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Settings, Profile & Data Backup"
        subtitle="Everything is editable. Export or restore your entire kitchen database as JSON anytime."
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Profile & Nutrition Targets */}
        <Card className="lg:col-span-7 p-5 space-y-4">
          <CardHeader title="Personal Profile & Nutrition Targets" icon={<User size={18} />} />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Field label="Name">
              <Input value={p.name} onChange={(e) => state.setPrefs({ name: e.target.value })} />
            </Field>
            <Field label="Exact age">
              <Input
                type="number"
                value={p.age ?? ''}
                placeholder="18 or 19"
                onChange={(e) => state.setPrefs({ age: e.target.value ? Number(e.target.value) : null, ageConfirmed: true })}
              />
            </Field>
            <Field label="Height (inches)" hint={`73 in = 6'1"`}>
              <Input type="number" value={p.heightIn} onChange={(e) => state.setPrefs({ heightIn: Number(e.target.value) })} />
            </Field>
            <Field label="Current weight (lbs)">
              <Input type="number" step="0.5" value={p.weightLb} onChange={(e) => state.setPrefs({ weightLb: Number(e.target.value) })} />
            </Field>
            <Field label="Aspirational weight (lbs)">
              <Input type="number" step="0.5" value={p.goalWeightLb} onChange={(e) => state.setPrefs({ goalWeightLb: Number(e.target.value) })} />
            </Field>
            <Field label="Activity level">
              <Select value={p.activity} onChange={(e) => state.setPrefs({ activity: e.target.value as any })}>
                <option value="sedentary">Sedentary</option>
                <option value="light">Lightly active</option>
                <option value="moderate">Moderately active</option>
                <option value="active">Very active</option>
              </Select>
            </Field>
            <Field label="Protein target (g/day)" hint="Default 120–140 g">
              <Input type="number" value={p.proteinTarget} onChange={(e) => state.setPrefs({ proteinTarget: Number(e.target.value) })} />
            </Field>
            <Field label="Calorie guide (kcal/day)" hint={suggested ? `Suggested ~${suggested} kcal` : 'Confirm age first'}>
              <Input
                type="number"
                placeholder="Optional / flexible"
                value={p.calorieTarget ?? ''}
                onChange={(e) => state.setPrefs({ calorieTarget: e.target.value ? Number(e.target.value) : null })}
              />
            </Field>
            <Field label="Fiber target (g/day)">
              <Input type="number" value={p.fiberTarget} onChange={(e) => state.setPrefs({ fiberTarget: Number(e.target.value) })} />
            </Field>
            <Field label="Daily water goal (fl oz)">
              <Input type="number" value={p.waterGoalOz} onChange={(e) => state.setPrefs({ waterGoalOz: Number(e.target.value) })} />
            </Field>
            <Field label="Default bottle size (fl oz)">
              <Input type="number" step="0.1" value={p.defaultBottleOz} onChange={(e) => state.setPrefs({ defaultBottleOz: Number(e.target.value) })} />
            </Field>
            <Field label="Default trip budget ($)">
              <Input type="number" value={p.defaultBudget} onChange={(e) => state.setPrefs({ defaultBudget: Number(e.target.value) })} />
            </Field>
          </div>

          <Field label="Preferred cuisines">
            <div className="flex flex-wrap gap-1.5">
              {(['Indian', 'Mexican', 'Asian', 'Western', 'Italian'] as Cuisine[]).map((c) => {
                const on = p.cuisines.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => state.setPrefs({ cuisines: on ? p.cuisines.filter((x) => x !== c) : [...p.cuisines, c] })}
                    className={`px-3 py-1 rounded-full text-xs border ${on ? 'bg-brand-600 text-white border-brand-600' : 'bg-white border-line'}`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </Field>

          <Toggle
            checked={p.deductBottleOnLog}
            onChange={(v) => state.setPrefs({ deductBottleOnLog: v })}
            label="Automatically deduct 1 bottle from water inventory when logging '+1 Bottle'"
          />
        </Card>

        {/* Backup, Portability & Storage Locations */}
        <div className="lg:col-span-5 space-y-5">
          <Card className="p-5 space-y-3">
            <CardHeader
              title="Backup, Export & Restore (JSON)"
              subtitle="Data is stored locally in IndexedDB + LocalStorage mirror. Export a backup anytime."
              icon={<Database size={18} />}
            />
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" onClick={exportJson}>
                <Download size={15} /> Export all data (.json)
              </Button>
              <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-line text-sm font-medium cursor-pointer hover:bg-line-2">
                <Upload size={15} /> Import JSON backup
                <input type="file" accept="application/json,.json" onChange={importJson} className="hidden" />
              </label>
            </div>
            <div className="pt-2 border-t border-line flex items-center justify-between">
              <span className="text-xs text-ink-3">Reset to initial pre-seeded kitchen state</span>
              <Button
                size="sm"
                variant="danger"
                onClick={() => {
                  state.resetData();
                  toast('Reset to initial seeded inventory & recipes');
                }}
              >
                <RotateCcw size={14} /> Reset to defaults
              </Button>
            </div>
          </Card>

          <Card className="p-5 space-y-3">
            <CardHeader title="Storage Locations" subtitle="Customize kitchen storage areas" icon={<FolderOpen size={18} />} />
            <div className="flex flex-wrap gap-1.5">
              {state.locations.map((l) => (
                <span key={l.id} className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-1 text-xs bg-white">
                  {l.name}
                  {!l.builtin && (
                    <button onClick={() => state.removeLocation(l.id)} className="text-ink-3 hover:text-red-600">×</button>
                  )}
                </span>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newLoc.trim()) return;
                state.addLocation(newLoc.trim());
                setNewLoc('');
                toast('Added storage location');
              }}
              className="flex gap-2"
            >
              <Input value={newLoc} onChange={(e) => setNewLoc(e.target.value)} placeholder="New location (e.g. Garage shelf, Spice rack)..." />
              <Button type="submit" variant="secondary">Add</Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
