import { useEffect, useState } from 'react';
import { CheckSquare, Square, RotateCcw } from 'lucide-react';
import { OPTIMIZATION_CHECKLIST, type OptimizationItem } from '../data/apnAndTips';
import { computeChecklistProgress } from '../utils/diagnostics';

const STORAGE_KEY = 'driver_diag_checklist_v1';

type CategoryFilter = 'all' | OptimizationItem['category'];

const FILTER_TABS: { id: CategoryFilter; label: string }[] = [
  { id: 'all', label: 'همه موارد' },
  { id: 'gps', label: 'GPS و موقعیت' },
  { id: 'apn', label: 'آنتن و APN' },
  { id: 'system', label: 'باتری و سیستم' },
];

export function OptimizationChecklist() {
  const [completedIds, setCompletedIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
    } catch {
      return [];
    }
  });
  const [filter, setFilter] = useState<CategoryFilter>('all');

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(completedIds));
    } catch {
      // Storage unavailable
    }
  }, [completedIds]);

  const completedSet = new Set(completedIds);
  const progress = computeChecklistProgress(
    OPTIMIZATION_CHECKLIST.map((item) => item.id),
    completedSet,
  );

  const visibleItems =
    filter === 'all'
      ? OPTIMIZATION_CHECKLIST
      : OPTIMIZATION_CHECKLIST.filter((item) => item.category === filter);

  const toggleItem = (id: string) => {
    setCompletedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  return (
    <section
      id="optimization-checklist"
      aria-labelledby="checklist-heading"
      className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6"
    >
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <span>اقدامات واقعی سیستم‌عامل اندروید</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">
              {progress.completedCount} از {progress.totalCount} مورد انجام شده ({progress.percent}%)
            </span>
          </div>
          <h2 id="checklist-heading" className="text-xl font-bold text-slate-900">
            چک‌لیست کاهش افت آنتن و تثبیت GPS در گوشی
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-xl">
            {FILTER_TABS.map((tab) => {
              const active = filter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id)}
                  className={`min-h-[38px] px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {completedIds.length > 0 && (
            <button
              type="button"
              onClick={() => setCompletedIds([])}
              className="min-h-[40px] px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>بازنشانی</span>
            </button>
          )}
        </div>
      </div>

      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden" aria-hidden="true">
        <div
          className="h-full bg-teal-600 transition-all duration-300"
          style={{ width: `${progress.percent}%` }}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {visibleItems.map((item) => {
          const checked = completedSet.has(item.id);
          return (
            <button
              key={item.id}
              type="button"
              role="checkbox"
              aria-checked={checked}
              onClick={() => toggleItem(item.id)}
              className={`text-right border rounded-xl p-4 transition-colors flex items-start gap-3 cursor-pointer ${
                checked
                  ? 'bg-teal-50/50 border-teal-200'
                  : 'bg-white border-slate-200 hover:bg-slate-50/70'
              }`}
            >
              <span className="mt-0.5 shrink-0">
                {checked ? (
                  <CheckSquare className="w-5 h-5 text-teal-700" aria-hidden="true" />
                ) : (
                  <Square className="w-5 h-5 text-slate-400" aria-hidden="true" />
                )}
              </span>

              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>{item.categoryLabel}</span>
                  <span aria-hidden="true">·</span>
                  <span>{checked ? 'انجام شد' : 'در انتظار بررسی'}</span>
                </div>
                <p className={`text-sm font-bold leading-snug ${checked ? 'text-teal-950 line-through decoration-teal-700/40' : 'text-slate-900'}`}>
                  {item.title}
                </p>
                <p className="text-xs text-slate-600 leading-relaxed">{item.detail}</p>
                <p className="text-[11px] font-mono text-slate-500 pt-1 break-all" dir="ltr">
                  {item.androidPath}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
