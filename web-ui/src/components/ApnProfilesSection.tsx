import { useState } from 'react';
import { Check, Copy, Radio } from 'lucide-react';
import { OPERATOR_APN_PROFILES, type OperatorApnProfile } from '../data/apnAndTips';

export function ApnProfilesSection() {
  const [selectedId, setSelectedId] = useState<OperatorApnProfile['id']>('mci');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const activeProfile =
    OPERATOR_APN_PROFILES.find((op) => op.id === selectedId) ?? OPERATOR_APN_PROFILES[0];

  const handleCopyField = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(`${activeProfile.id}-${label}`);
      window.setTimeout(() => setCopiedKey(null), 1600);
    } catch {
      // Clipboard blocked in restricted context
    }
  };

  return (
    <section
      id="apn-profiles"
      aria-labelledby="apn-profiles-heading"
      className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6"
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <span>تنظیم دستی در بخش Mobile Networks اندروید</span>
            <span aria-hidden="true">·</span>
            <span>کپی تک‌کلیکی</span>
          </div>
          <h2 id="apn-profiles-heading" className="text-xl font-bold text-slate-900">
            تنظیمات استاندارد APN اپراتورهای ایران
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed max-w-2xl">
            ثبت صحیح APN همراه با پارامتر <code className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-800" dir="ltr">supl</code> در فیلد APN type به دریافت داده‌های کمکی ماهواره (A-GPS) و کاهش قطعی هنگام جابه‌جایی بین دکل‌ها کمک می‌کند.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="انتخاب اپراتور تلفن همراه"
          className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-xl shrink-0"
        >
          {OPERATOR_APN_PROFILES.map((op) => {
            const isActive = op.id === activeProfile.id;
            return (
              <button
                key={op.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setSelectedId(op.id)}
                className={`min-h-[40px] px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {op.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 bg-slate-50/70 rounded-xl overflow-hidden">
          <div className="bg-slate-100/80 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-teal-700" aria-hidden="true" />
              <span className="text-sm font-bold text-slate-900">{activeProfile.name}</span>
            </div>
            <span className="text-xs text-slate-500 font-mono tabular-nums">{activeProfile.subtitle}</span>
          </div>

          <div className="divide-y divide-slate-200/70">
            {activeProfile.fields.map((field) => {
              const key = `${activeProfile.id}-${field.label}`;
              const isCopied = copiedKey === key;
              return (
                <div
                  key={field.label}
                  className="px-4 py-3 flex items-center justify-between gap-4 hover:bg-slate-100/60 transition-colors"
                >
                  <div className="min-w-0">
                    <span className="text-xs text-slate-500 block font-mono" dir="ltr">
                      {field.label}
                    </span>
                    <span className="text-sm font-semibold text-slate-900 font-mono break-all" dir="ltr">
                      {field.value}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCopyField(field.label, field.value)}
                    aria-label={`کپی مقدار ${field.label}`}
                    className="min-h-[38px] px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                        <span className="text-teal-800">کپی شد</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>کپی</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-slate-50 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-slate-900">نکته پایداری برای {activeProfile.name}</h3>
          <p className="text-sm text-slate-700 leading-relaxed">{activeProfile.stabilityTip}</p>

          <div className="border-t border-slate-200 pt-4 space-y-2">
            <p className="text-xs font-semibold text-slate-800">مسیر ساخت یا ویرایش APN در اندروید:</p>
            <ol className="text-xs text-slate-600 space-y-1.5 list-decimal list-inside leading-relaxed">
              <li>وارد تنظیمات گوشی (<span className="font-mono">Settings</span>) شوید.</li>
              <li>به بخش <span className="font-mono">Connections / SIM cards &amp; mobile networks</span> بروید.</li>
              <li>سیم‌کارت دیتا را انتخاب کرده و وارد <span className="font-mono">Access Point Names</span> شوید.</li>
              <li>مقادیر جدول را با دقت وارد و از منوی سه‌نقطه <span className="font-semibold text-slate-800">Save</span> کنید، سپس یک بار حالت هواپیما را روشن و خاموش نمایید.</li>
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
