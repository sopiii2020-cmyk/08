import { useEffect, useState } from 'react';
import {
  ExternalLink,
  RefreshCw,
  ShieldCheck,
  Sliders,
  Radio,
  LocateFixed,
  Satellite,
  AlertTriangle,
} from 'lucide-react';
import { isNativeAndroid, subscribeNativeState, type NativeSnapshot } from '../utils/nativeBridge';

export function NativeActionsBanner() {
  const [nativeState, setNativeState] = useState<NativeSnapshot | null>(null);
  const [xtraFeedback, setXtraFeedback] = useState<string | null>(null);
  const native = isNativeAndroid();

  useEffect(() => {
    if (!native) return;
    return subscribeNativeState((snap) => setNativeState(snap));
  }, [native]);

  if (!native) return null;

  const bridge = window.NativeAndroidBridge;
  const running = nativeState?.running ?? false;
  const fineGranted = nativeState?.fineLocationGranted ?? true;
  const locationEnabled = nativeState?.locationEnabled ?? true;
  const satUsed = nativeState?.gnssSatellitesUsed ?? 0;
  const satTotal = nativeState?.gnssSatellitesTotal ?? 0;

  const handleXtraRefresh = () => {
    if (!bridge) return;
    const ok = bridge.refreshAgpsXtra();
    setXtraFeedback(
      ok
        ? 'درخواست بروزرسانی داده‌های کمکی A-GPS / XTRA به چیپ GPS ارسال شد.'
        : 'دستور بروزرسانی زمان و ماهواره ارسال شد (در فضای باز و با روشن بودن GPS اثرگذار است).',
    );
    window.setTimeout(() => setXtraFeedback(null), 4000);
  };

  return (
    <section
      aria-labelledby="native-driver-controls-heading"
      className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-slate-500">
            <span className="whitespace-nowrap">
              {nativeState?.snappInstalled ? 'اسنپ رانندگان نصب است' : 'اسنپ رانندگان یافت نشد'}
            </span>
            <span aria-hidden="true">·</span>
            <span className="whitespace-nowrap">{running ? 'سرویس بی‌صدا فعال است' : 'سرویس خاموش است'}</span>
            {satTotal > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="whitespace-nowrap tabular-nums">
                  ماهواره: {satUsed} از {satTotal}
                </span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span className="whitespace-nowrap">
              {nativeState?.ignoringBattery ? 'معاف از باتری' : 'نیازمند معافیت باتری'}
            </span>
          </div>
          <h2 id="native-driver-controls-heading" className="text-lg sm:text-xl font-bold text-slate-900">
            کنترل سرویس پس‌زمینه و اجرای سریع اسنپ رانندگان
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => bridge?.startServiceAndLaunchSnapp()}
            className="w-full sm:w-auto min-h-[44px] px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-xl transition-colors flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ExternalLink className="w-4 h-4" aria-hidden="true" />
            <span>فعال‌سازی سرویس و باز کردن اسنپ رانندگان</span>
          </button>

          <button
            type="button"
            onClick={() => (running ? bridge?.stopKeepAlive() : bridge?.startKeepAlive())}
            className="w-full sm:w-auto min-h-[44px] px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center justify-center whitespace-nowrap shrink-0 cursor-pointer"
          >
            {running ? 'توقف سرویس' : 'فقط شروع سرویس'}
          </button>
        </div>
      </div>

      {(!fineGranted || !locationEnabled) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
            <p className="leading-relaxed">
              {!locationEnabled
                ? 'سرویس موقعیت مکانی (Location) گوشی خاموش است؛ برای رفع خطای «موقعیت تقریبی» در اسنپ، دقت بالای گوگل را فعال کنید.'
                : 'دسترسی دقیق GPS (Precise / Allow all the time) هنوز تایید نشده است و همین باعث نمایش موقعیت تقریبی می‌شود.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              !locationEnabled
                ? bridge?.requestHighAccuracyDialog?.()
                : bridge?.openSelfLocationPermission?.()
            }
            className="min-h-[38px] px-3 py-1.5 font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
          >
            {!locationEnabled ? 'روشن کردن دقت بالای GPS' : 'تایید دسترسی دقیق'}
          </button>
        </div>
      )}

      {xtraFeedback && (
        <div className="bg-teal-50 rounded-xl px-4 py-2.5 text-xs font-medium text-teal-900">
          {xtraFeedback}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
        <button
          type="button"
          onClick={() => bridge?.requestHighAccuracyDialog?.()}
          className="min-h-[44px] px-3 py-2 text-xs font-semibold text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Satellite className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
          <span>دقت بالای گوگل (Location Accuracy)</span>
        </button>

        <button
          type="button"
          onClick={handleXtraRefresh}
          className="min-h-[44px] px-3 py-2 text-xs font-semibold text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
          <span>تازه‌سازی A-GPS (XTRA)</span>
        </button>

        <button
          type="button"
          onClick={() => bridge?.openApnSettings()}
          className="min-h-[44px] px-3 py-2 text-xs font-semibold text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Radio className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
          <span>تنظیمات APN سیم‌کارت</span>
        </button>

        <button
          type="button"
          onClick={() => bridge?.openSelfLocationPermission?.() ?? bridge?.openLocationSettings()}
          className="min-h-[44px] px-3 py-2 text-xs font-semibold text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <LocateFixed className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
          <span>دسترسی دقیق و همیشگی GPS</span>
        </button>

        <button
          type="button"
          onClick={() => bridge?.openSnappBatterySettings()}
          className="min-h-[44px] px-3 py-2 text-xs font-semibold text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Sliders className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
          <span>باتری و دسترسی اسنپ</span>
        </button>

        <button
          type="button"
          onClick={() => bridge?.requestIgnoreBattery()}
          className="min-h-[44px] px-3 py-2 text-xs font-semibold text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <ShieldCheck className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
          <span>معافیت باتری این برنامه</span>
        </button>
      </div>
    </section>
  );
}
