import { useState, useEffect } from 'react';
import { get as idbGet, set as idbSet } from 'idb-keyval';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, BarChart, Bar } from 'recharts';
import { useStore } from '../lib/store';
import { useModals } from '../components/modals';
import { addDays, fmtDate, todayISO, uid, weekStart } from '../lib/dates';
import { ZERO, addN, bmi, roundN } from '../lib/nutrition';
import { Badge, Button, Card, CardHeader, Empty, Field, IconButton, Input, PageHeader, ProgressBar, Stat, toast } from '../components/ui';
import { Camera, Droplets, Dumbbell, Flame, HeartHandshake, Info, Plus, Scale, Trash2 } from 'lucide-react';

export function NutritionPage() {
  const state = useStore();
  const modals = useModals();
  const today = todayISO();

  const [quickFood, setQuickFood] = useState('');
  const [quickKcal, setQuickKcal] = useState('350');
  const [quickProt, setQuickProt] = useState('30');
  const [photoMap, setPhotoMap] = useState<Record<string, string>>({});

  useEffect(() => {
    let mounted = true;
    (async () => {
      const m: Record<string, string> = {};
      for (const p of state.photos) {
        const url = await idbGet<string>(`photo:${p.id}`);
        if (url) m[p.id] = url;
      }
      if (mounted) setPhotoMap(m);
    })();
    return () => { mounted = false; };
  }, [state.photos]);

  const todayLogs = state.foodLogs.filter((f) => f.date === today);
  const totals = roundN(todayLogs.reduce((acc, f) => addN(acc, f.nutrition), ZERO));
  const todayWater = state.waterLogs.filter((w) => w.date === today);
  const waterOz = Math.round(todayWater.reduce((s, w) => s + w.amountOz, 0) * 10) / 10;

  // 7-day nutrition bar chart
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(today, -6 + i);
    const logs = state.foodLogs.filter((f) => f.date === d);
    const t = roundN(logs.reduce((acc, f) => addN(acc, f.nutrition), ZERO));
    const w = state.waterLogs.filter((x) => x.date === d).reduce((s, x) => s + x.amountOz, 0);
    return { date: fmtDate(d), protein: t.protein, kcal: t.kcal, water: Math.round(w) };
  });

  // Weekly weight averages (compare weekly averages rather than single-day fluctuations)
  const weeklyWeights = (() => {
    const byWeek = new Map<string, number[]>();
    for (const w of state.weightLogs) {
      const wk = weekStart(w.date);
      byWeek.set(wk, [...(byWeek.get(wk) ?? []), w.weightLb]);
    }
    return [...byWeek.entries()].map(([wk, arr]) => ({
      week: fmtDate(wk),
      avg: Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10,
    }));
  })();

  const curBmi = Math.round(bmi(state.prefs.heightIn, state.prefs.weightLb) * 10) / 10;

  const uploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result);
      const id = uid('ph-');
      await idbSet(`photo:${id}`, dataUrl);
      state.addPhotoMeta(id, todayISO(), file.name);
      toast('Saved progress photo privately in local IndexedDB');
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Nutrition, Hydration & Recomposition Progress"
        subtitle="Estimated nutrition values (never medical facts). No guilt warnings — consistency, protein, and muscle retention come first."
        actions={
          <div className="flex gap-2">
            <Button variant="soft" onClick={modals.openSupport}><HeartHandshake size={15} /> Hunger / Stress helper</Button>
            <Button variant="primary" onClick={modals.openWeight}><Scale size={15} /> Record weight</Button>
          </div>
        }
      />

      {/* Supportive Recomposition Banner */}
      <div className="rounded-2xl bg-brand-50 border border-brand-100 p-4 text-xs text-brand-900 space-y-1">
        <div className="font-semibold flex items-center gap-1.5">
          <Info size={15} /> Body Recomposition & Sustainable Fat-Loss Principles
        </div>
        <p>
          At 6&apos;1&quot; and ~{state.prefs.weightLb} lbs (BMI ~{curBmi}), you are already within the conventional healthy BMI range. We prioritize <strong>~{state.prefs.proteinTarget}g protein/day</strong>, fiber-rich volume, and 3×/week resistance training so you look leaner and more athletic — even if your body composition improves at a weight above 160 lbs. Spot reduction of chest or belly fat is not biologically possible; steady overall fat loss + muscle building reshapes your frame.
        </p>
        <p className="text-ink-2">
          <em>Neutral health note:</em> Not all chest fullness is fat; any persistent lumps, asymmetry, or tenderness warrant a routine medical evaluation.
        </p>
      </div>

      {/* Macro summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Stat label="Protein today" value={`${totals.protein}g`} sub={`Goal: ${state.prefs.proteinTarget}g`} tone="green" />
        <Stat label="Calories (est.)" value={`${totals.kcal}`} sub={state.prefs.calorieTarget ? `Guide: ~${state.prefs.calorieTarget}` : 'Flexible'} />
        <Stat label="Carbohydrates" value={`${totals.carbs}g`} sub="Moderate carbs allowed" />
        <Stat label="Fat" value={`${totals.fat}g`} sub="Moderate fats" />
        <Stat label="Fiber" value={`${totals.fiber}g`} sub={`Goal: ${state.prefs.fiberTarget}g`} tone="blue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Today's food log & 7-day protein chart */}
        <div className="lg:col-span-7 space-y-5">
          <Card className="p-5 space-y-4">
            <CardHeader title="Today's Meals Eaten" subtitle="Logged automatically when you cook or eat a prepared meal, or add below" icon={<Flame size={18} />} />
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!quickFood.trim()) return;
                state.logFood({
                  name: quickFood.trim(),
                  servings: 1,
                  slot: 'any',
                  nutrition: { kcal: Number(quickKcal) || 0, protein: Number(quickProt) || 0, carbs: 25, fat: 10, fiber: 3 },
                });
                setQuickFood('');
                toast('Logged meal');
              }}
              className="grid grid-cols-1 sm:grid-cols-12 gap-2"
            >
              <div className="sm:col-span-6"><Input value={quickFood} onChange={(e) => setQuickFood(e.target.value)} placeholder="Quick log food (e.g. Protein shake, roti)..." /></div>
              <div className="sm:col-span-2"><Input type="number" value={quickKcal} onChange={(e) => setQuickKcal(e.target.value)} placeholder="kcal" /></div>
              <div className="sm:col-span-2"><Input type="number" value={quickProt} onChange={(e) => setQuickProt(e.target.value)} placeholder="Protein g" /></div>
              <div className="sm:col-span-2"><Button type="submit" variant="soft" className="w-full"><Plus size={15} /> Log</Button></div>
            </form>

            {todayLogs.length === 0 ? (
              <Empty title="No meals logged yet today" />
            ) : (
              <div className="divide-y divide-line border border-line rounded-2xl">
                {todayLogs.map((f) => (
                  <div key={f.id} className="px-3.5 py-2.5 flex items-center justify-between text-sm">
                    <div>
                      <span className="font-medium">{f.name}</span>
                      <span className="text-xs text-ink-3 ml-2">({f.servings} srv · {f.time})</span>
                      <div className="text-xs text-ink-3">
                        ~{f.nutrition.kcal} kcal · <strong>{f.nutrition.protein}g P</strong> · {f.nutrition.carbs}g C · {f.nutrition.fat}g F · {f.nutrition.fiber}g fiber
                      </div>
                    </div>
                    <IconButton label="Delete log" onClick={() => state.removeFoodLog(f.id)}><Trash2 size={15} /></IconButton>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-5">
            <CardHeader title="7-Day Protein Consistency (g)" subtitle="Steady daily protein matters far more than perfection" />
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={last7}>
                  <XAxis dataKey="date" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="protein" fill="#2f6b4f" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Optional 3-Day Resistance Training + Walking Framework */}
          <Card className="p-5 space-y-3">
            <CardHeader
              title="Optional 3-Day Resistance Training + Walking Framework"
              subtitle="Supports chest, shoulder & waist recomposition — meal planning is never dependent on exercise"
              icon={<Dumbbell size={18} />}
            />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="rounded-xl border border-line p-3 bg-canvas">
                <div className="font-semibold">Day A — Push & Squat (35m)</div>
                <div className="text-ink-2 mt-1">Incline push-ups / bench press 3×8–12 · Goblet squats 3×10 · Overhead press 3×10 · Plank 2×45s</div>
                <Button size="sm" variant="soft" className="mt-2" onClick={() => { state.addWorkout({ date: today, session: 'A', minutes: 35 }); toast('Logged Workout A!'); }}>Log Session A</Button>
              </div>
              <div className="rounded-xl border border-line p-3 bg-canvas">
                <div className="font-semibold">Day B — Pull & Hinge (35m)</div>
                <div className="text-ink-2 mt-1">Rows / pull-downs 3×10 · Romanian deadlift 3×10 · Push-ups 3×AMRAP · Carries / curls 2×12</div>
                <Button size="sm" variant="soft" className="mt-2" onClick={() => { state.addWorkout({ date: today, session: 'B', minutes: 35 }); toast('Logged Workout B!'); }}>Log Session B</Button>
              </div>
              <div className="rounded-xl border border-line p-3 bg-canvas">
                <div className="font-semibold">Daily Walking</div>
                <div className="text-ink-2 mt-1">25–40 min brisk walk (low-fatigue fat oxidation & stress relief without spiking evening hunger).</div>
                <Button size="sm" variant="soft" className="mt-2" onClick={() => { state.addWorkout({ date: today, session: 'walk', minutes: 30 }); toast('Logged 30m walk!'); }}>Log Walk</Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Right: Weekly Weight Trend, Water History, Progress Photos */}
        <div className="lg:col-span-5 space-y-5">
          <Card className="p-5 space-y-3">
            <CardHeader
              title="Weekly Weight Trend & Measurements"
              subtitle="Comparing weekly averages rather than single-day water fluctuations"
              icon={<Scale size={18} />}
              action={<Button size="sm" variant="soft" onClick={modals.openWeight}>+ Log</Button>}
            />
            {weeklyWeights.length > 0 ? (
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weeklyWeights}>
                    <XAxis dataKey="week" fontSize={11} />
                    <YAxis domain={['auto', 'auto']} fontSize={11} />
                    <Tooltip />
                    <Line type="monotone" dataKey="avg" stroke="#2f6b4f" strokeWidth={2.5} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-xs text-ink-3 py-3">Log your weight to see weekly average trends.</div>
            )}

            <div className="max-h-40 overflow-y-auto divide-y divide-line border border-line rounded-2xl text-xs">
              {[...state.weightLogs].reverse().map((w) => (
                <div key={w.id} className="px-3 py-2 flex items-center justify-between">
                  <div>
                    <strong>{w.weightLb} lbs</strong> · {w.date}
                    {w.waistIn ? ` · Waist ${w.waistIn}"` : ''}
                    {w.chestIn ? ` · Chest ${w.chestIn}"` : ''}
                  </div>
                  <button onClick={() => state.removeWeight(w.id)} className="text-ink-3 hover:text-red-600">×</button>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5 space-y-3">
            <CardHeader title="Water Consumption History" subtitle={`Today: ${waterOz} / ${state.prefs.waterGoalOz} fl oz`} icon={<Droplets size={18} />} />
            <ProgressBar value={waterOz} max={state.prefs.waterGoalOz} tone="blue" />
            <div className="max-h-36 overflow-y-auto divide-y divide-line border border-line rounded-2xl text-xs">
              {todayWater.length === 0 ? (
                <div className="p-3 text-ink-3">No water logged yet today.</div>
              ) : (
                [...todayWater].reverse().map((w) => (
                  <div key={w.id} className="px-3 py-1.5 flex items-center justify-between">
                    <span>{w.amountOz} oz ({w.kind}) at {w.time}</span>
                    <button onClick={() => state.removeWaterLog(w.id)} className="text-ink-3 hover:text-red-600">Undo</button>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card className="p-5 space-y-3">
            <CardHeader title="Private Progress Photos" subtitle="Stored locally in your browser's IndexedDB — never uploaded" icon={<Camera size={18} />} />
            <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-line bg-white text-xs font-medium cursor-pointer hover:bg-line-2">
              <Camera size={14} /> Add private progress photo
              <input type="file" accept="image/*" onChange={uploadPhoto} className="hidden" />
            </label>
            {state.photos.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {state.photos.map((p) => (
                  <div key={p.id} className="relative rounded-xl overflow-hidden border border-line">
                    {photoMap[p.id] && <img src={photoMap[p.id]} alt={p.date} className="w-full h-24 object-cover" />}
                    <div className="p-1 text-[10px] flex justify-between items-center bg-white">
                      <span>{p.date}</span>
                      <button onClick={() => state.removePhoto(p.id)} className="text-red-600">×</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
