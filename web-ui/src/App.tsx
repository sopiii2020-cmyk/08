/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState, type ReactNode } from 'react';
import { Info } from 'lucide-react';
import { GpsMonitorCard } from './components/GpsMonitorCard';
import { NetworkProbeCard } from './components/NetworkProbeCard';
import { ApnProfilesSection } from './components/ApnProfilesSection';
import { OptimizationChecklist } from './components/OptimizationChecklist';
import { NativeActionsBanner } from './components/NativeActionsBanner';
import { isNativeAndroid } from './utils/nativeBridge';

interface AppProps {
  exportSection?: ReactNode;
}

export default function App({ exportSection }: AppProps) {
  const [autoStartTrigger, setAutoStartTrigger] = useState(0);
  const nativeAndroid = isNativeAndroid();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      setAutoStartTrigger((prev) => prev + 1);
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          <a
            href="#top"
            className="text-base sm:text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            پایشگر GPS و اتصال
          </a>

          <nav aria-label="بخش‌های اصلی" className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <a href="#gps-monitor" className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
              پایش GPS
            </a>
            <a href="#network-probe" className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
              تست پایداری
            </a>
            <a href="#apn-profiles" className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
              تنظیمات APN
            </a>
            <a href="#optimization-checklist" className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
              چک‌لیست اندروید
            </a>
            {!nativeAndroid && exportSection && (
              <a href="#android-export" className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
                دریافت ZIP اندروید
              </a>
            )}
          </nav>

          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => setAutoStartTrigger((prev) => prev + 1)}
              className="min-h-[42px] px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              شروع پایش هم‌زمان
            </button>
          </div>
        </div>
      </header>

      <main id="top" className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
        <section className="space-y-4">
          <div className="space-y-2 max-w-3xl">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-tight" style={{ textWrap: 'balance' }}>
              عیب‌یابی واقعی دقت GPS، نوسان اینترنت و تنظیمات APN برای رانندگان
            </h1>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              از این پنل برای سنجش خطای GPS، تازه‌سازی داده‌های کمکی ماهواره (A-GPS)، کاهش افت اتصال دیتا با Keep-Alive و اعمال تنظیمات استاندارد APN و اندروید استفاده کنید.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex items-start gap-3">
            <Info className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
              <strong className="font-semibold text-slate-900">شفافیت فنی:</strong> هیچ برنامه غیرسیستمی (بدون روت) نمی‌تواند قدرت سخت‌افزاری آنتن مخابراتی را افزایش دهد یا APN گوشی را مخفیانه ویرایش کند. این ابزار با سرویس بی‌صدای پس‌زمینه، تازه‌سازی A-GPS/XTRA و ارسال پالس Keep-Alive اتصال دیتا و قفل GPS را تا بیشترین حد ممکنِ مجاز در اندروید پایدار نگه می‌دارد و دسترسی سریع به تنظیمات APN را فراهم می‌کند.
            </p>
          </div>
        </section>

        <NativeActionsBanner />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          <GpsMonitorCard autoStartTrigger={autoStartTrigger} />
          <NetworkProbeCard autoStartTrigger={autoStartTrigger} />
        </div>

        <ApnProfilesSection />

        <OptimizationChecklist />

        {!nativeAndroid && exportSection}
      </main>

      <footer className="border-t border-slate-200 bg-white mt-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
          <span>ابزار سنجش زنده GPS و پایداری اتصال اینترنت</span>
          <span className="font-mono">Geolocation · Network Probe · Android APN Guide</span>
        </div>
      </footer>
    </div>
  );
}
