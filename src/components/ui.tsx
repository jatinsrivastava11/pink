import { useEffect, type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes, type SelectHTMLAttributes } from 'react';
import { create } from 'zustand';
import clsx from 'clsx';
import { Minus, Plus, X, CheckCircle2, AlertCircle, Info } from 'lucide-react';

export const cx = clsx;

// ───────── Button ─────────
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft';
export function Button({ variant = 'secondary', size = 'md', className, children, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <button
      {...p}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition active:scale-[.98] disabled:opacity-40 disabled:pointer-events-none select-none',
        size === 'sm' && 'px-3 py-1.5 text-[13px]',
        size === 'md' && 'px-4 py-2.5 text-sm',
        size === 'lg' && 'px-5 py-3.5 text-base',
        variant === 'primary' && 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm',
        variant === 'secondary' && 'bg-white border border-line text-ink hover:bg-line-2',
        variant === 'ghost' && 'text-ink-2 hover:bg-line-2',
        variant === 'soft' && 'bg-brand-50 text-brand-700 hover:bg-brand-100',
        variant === 'danger' && 'bg-red-50 text-red-700 hover:bg-red-100',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function IconButton({ className, children, label, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button aria-label={label} title={label} {...p} className={cx('inline-flex items-center justify-center rounded-xl w-9 h-9 text-ink-2 hover:bg-line-2 active:scale-95 transition disabled:opacity-30', className)}>
      {children}
    </button>
  );
}

// ───────── Card ─────────
export function Card({ className, children, ...p }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return <div {...p} className={cx('card', className)}>{children}</div>;
}

export function CardHeader({ title, icon, action, subtitle }: { title: ReactNode; icon?: ReactNode; action?: ReactNode; subtitle?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 mb-3">
      <div className="flex items-center gap-2.5 min-w-0">
        {icon && <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">{icon}</div>}
        <div className="min-w-0">
          <h3 className="font-semibold text-[15px] leading-tight truncate">{title}</h3>
          {subtitle && <p className="text-xs text-ink-3 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

// ───────── Badge ─────────
type Tone = 'neutral' | 'green' | 'amber' | 'red' | 'blue' | 'pink' | 'outline';
export function Badge({ tone = 'neutral', className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap',
        tone === 'neutral' && 'bg-line-2 text-ink-2',
        tone === 'green' && 'bg-brand-50 text-brand-700',
        tone === 'amber' && 'bg-amber-50 text-amber-800',
        tone === 'red' && 'bg-red-50 text-red-700',
        tone === 'blue' && 'bg-sky-50 text-sky-800',
        tone === 'pink' && 'bg-blush-50 text-pink-800',
        tone === 'outline' && 'border border-line text-ink-2',
        className,
      )}
    >
      {children}
    </span>
  );
}

// ───────── Inputs ─────────
export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="block text-xs font-medium text-ink-2 mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-ink-3 mt-1">{hint}</span>}
    </label>
  );
}
export function Input(p: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className={cx('input', p.className)} />;
}
export function Select({ children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...p} className={cx('input appearance-none bg-[url("data:image/svg+xml;utf8,<svg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%237c8680%27 stroke-width=%272.5%27><path d=%27m6 9 6 6 6-6%27/></svg>")] bg-no-repeat bg-[right_0.75rem_center] pr-8', p.className)}>
      {children}
    </select>
  );
}
export function Textarea(p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...p} className={cx('input min-h-[80px]', p.className)} />;
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex items-center gap-3 text-sm text-left">
      <span className={cx('relative w-10 h-6 rounded-full transition shrink-0', checked ? 'bg-brand-500' : 'bg-line')}>
        <span className={cx('absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition', checked ? 'left-[18px]' : 'left-0.5')} />
      </span>
      {label}
    </button>
  );
}

// ───────── Stepper (− qty +) ─────────
export function Stepper({ value, onDec, onInc, label, onEdit, size = 'md' }: { value: ReactNode; onDec: () => void; onInc: () => void; label?: string; onEdit?: () => void; size?: 'md' | 'lg' }) {
  const btn = cx('flex items-center justify-center rounded-full bg-line-2 hover:bg-brand-50 hover:text-brand-700 active:scale-90 transition text-ink-2', size === 'lg' ? 'w-11 h-11' : 'w-8 h-8');
  return (
    <div className="flex items-center gap-1.5">
      <button aria-label={`Decrease ${label ?? ''}`} onClick={onDec} className={btn}><Minus size={size === 'lg' ? 18 : 15} /></button>
      <button onClick={onEdit} className={cx('min-w-[72px] text-center tabular-nums font-medium rounded-lg px-1 hover:bg-line-2', size === 'lg' ? 'text-base' : 'text-[13px]')}>{value}</button>
      <button aria-label={`Increase ${label ?? ''}`} onClick={onInc} className={btn}><Plus size={size === 'lg' ? 18 : 15} /></button>
    </div>
  );
}

// ───────── Modal / sheet ─────────
export function Modal({ open, onClose, title, children, footer, wide, full }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean; full?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', h);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center anim-fade no-print">
      <div className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]" onClick={onClose} />
      <div
        role="dialog"
        className={cx(
          'relative bg-surface w-full flex flex-col anim-up shadow-2xl',
          full ? 'h-[100dvh] sm:h-[92vh] sm:max-w-3xl sm:rounded-3xl' : 'max-h-[92dvh] rounded-t-3xl sm:rounded-3xl',
          !full && (wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'),
        )}
      >
        <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3 border-b border-line-2">
          <div className="font-semibold text-[17px] min-w-0 truncate">{title}</div>
          <IconButton label="Close" onClick={onClose}><X size={18} /></IconButton>
        </div>
        <div className="overflow-y-auto px-5 py-4 flex-1">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-line-2 flex gap-2 justify-end safe-bottom bg-surface rounded-b-3xl">{footer}</div>}
      </div>
    </div>
  );
}

// ───────── Progress ─────────
export function ProgressBar({ value, max, tone = 'green', className }: { value: number; max: number; tone?: 'green' | 'blue' | 'amber' | 'pink'; className?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className={cx('h-2 rounded-full bg-line-2 overflow-hidden', className)}>
      <div
        className={cx('h-full rounded-full transition-all duration-500', tone === 'green' && 'bg-brand-500', tone === 'blue' && 'bg-sky-400', tone === 'amber' && 'bg-amber-400', tone === 'pink' && 'bg-blush')}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function Ring({ value, max, size = 92, stroke = 9, color = '#3d7a58', children }: { value: number; max: number; size?: number; stroke?: number; color?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#f0eee8" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} style={{ transition: 'stroke-dashoffset .6s ease' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

// ───────── Empty ─────────
export function Empty({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="text-center py-8 px-4">
      {icon && <div className="mx-auto w-12 h-12 rounded-2xl bg-line-2 text-ink-3 flex items-center justify-center mb-3">{icon}</div>}
      <p className="font-medium text-sm">{title}</p>
      {children && <div className="text-xs text-ink-3 mt-1">{children}</div>}
    </div>
  );
}

// ───────── Tabs / chips ─────────
export function Chips<T extends string>({ options, value, onChange, className }: { options: { value: T; label: ReactNode; count?: number }[]; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div className={cx('flex gap-1.5 overflow-x-auto no-scrollbar', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cx('px-3 py-1.5 rounded-full text-[13px] whitespace-nowrap border transition', value === o.value ? 'bg-ink text-white border-ink' : 'bg-white border-line text-ink-2 hover:border-ink-3')}
        >
          {o.label}
          {o.count != null && <span className={cx('ml-1.5 text-[11px]', value === o.value ? 'text-white/70' : 'text-ink-3')}>{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

// ───────── Toasts ─────────
interface Toast { id: number; text: string; tone: 'ok' | 'err' | 'info'; action?: { label: string; fn: () => void } }
export const useToasts = create<{ toasts: Toast[]; push: (t: Omit<Toast, 'id'>) => void; dismiss: (id: number) => void }>((set) => ({
  toasts: [],
  push: (t) => {
    const id = Date.now() + Math.random();
    set((s) => ({ toasts: [...s.toasts, { ...t, id }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), 3500);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));
export const toast = (text: string, tone: Toast['tone'] = 'ok', action?: Toast['action']) => useToasts.getState().push({ text, tone, action });

export function Toaster() {
  const { toasts, dismiss } = useToasts();
  return (
    <div className="fixed z-[60] left-1/2 -translate-x-1/2 bottom-24 lg:bottom-6 flex flex-col gap-2 w-[min(92vw,420px)] no-print">
      {toasts.map((t) => (
        <div key={t.id} className="anim-up flex items-center gap-3 bg-ink text-white rounded-2xl px-4 py-3 shadow-xl text-sm">
          {t.tone === 'ok' && <CheckCircle2 size={18} className="text-brand-300 shrink-0" />}
          {t.tone === 'err' && <AlertCircle size={18} className="text-red-300 shrink-0" />}
          {t.tone === 'info' && <Info size={18} className="text-sky-300 shrink-0" />}
          <span className="flex-1">{t.text}</span>
          {t.action && (
            <button className="font-semibold text-brand-200" onClick={() => { t.action!.fn(); dismiss(t.id); }}>{t.action.label}</button>
          )}
        </div>
      ))}
    </div>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'amber' | 'red' | 'green' | 'blue' }) {
  return (
    <div className={cx('rounded-2xl px-3.5 py-3 border', tone === 'amber' ? 'bg-amber-soft border-amber-100' : tone === 'red' ? 'bg-red-50/60 border-red-100' : tone === 'blue' ? 'bg-sky-soft border-sky-100' : tone === 'green' ? 'bg-brand-50 border-brand-100' : 'bg-white border-line')}>
      <div className="text-[11px] uppercase tracking-wide text-ink-3 font-medium">{label}</div>
      <div className="text-xl font-semibold mt-0.5 tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-ink-3 mt-0.5">{sub}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
      <div>
        <h1 className="font-display text-[28px] lg:text-[32px] leading-tight">{title}</h1>
        {subtitle && <p className="text-sm text-ink-3 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
