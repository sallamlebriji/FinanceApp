import type { PeriodPreset } from '@mizan/shared';
import { create } from 'zustand';

export const PERIOD_LABELS: Record<PeriodPreset, string> = {
  'this-month': 'This month',
  'last-month': 'Last month',
  'last-3-months': 'Last 3 months',
  'this-year': 'This year',
  'last-12-months': 'Last 12 months',
};

const KEY = 'mizan.period';
function initial(): PeriodPreset {
  try {
    const v = localStorage.getItem(KEY) as PeriodPreset | null;
    if (v && v in PERIOD_LABELS) return v;
  } catch {
    /* storage unavailable */
  }
  return 'this-month';
}

/** Global reporting period shared by the top bar and the dashboard (a per-viewer convenience). */
export const usePeriod = create<{ preset: PeriodPreset; setPreset(p: PeriodPreset): void }>((set) => ({
  preset: initial(),
  setPreset: (preset) => {
    try {
      localStorage.setItem(KEY, preset);
    } catch {
      /* ignore */
    }
    set({ preset });
  },
}));
