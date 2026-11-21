import { useEffect, useRef, useState } from 'react';
import { Compass, Copy, Check, LocateFixed, Lock, Unlock, RefreshCw, AlertCircle } from 'lucide-react';
import { classifyGpsAccuracy, formatCoordinate, formatSpeedKmh } from '../utils/diagnostics';
import { isNativeAndroid, subscribeNativeState } from '../utils/nativeBridge';

interface GpsReading {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude: number | null;
  speed: number | null;
  heading: number | null;
  timestamp: number;
}

interface GpsMonitorCardProps {
  autoStartTrigger?: number;
}

export function GpsMonitorCard({ autoStartTrigger = 0 }: GpsMonitorCardProps) {
  const [status, setStatus] = useState<'idle' | 'acquiring' | 'active' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reading, setReading] = useState<GpsReading | null>(null);
  const [lockDurationMs, setLockDurationMs] = useState<number | null>(null);
  const [updateCount, setUpdateCount] = useState(0);
  const [copiedCoords, setCopiedCoords] = useState(false);

  const [wakeLockSupported] = useState(() => typeof navigator !== 'undefined' && 'wakeLock' in navigator);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [wakeLockNote, setWakeLockNote] = useState<string | null>(null);
  const [satInfo, setSatInfo] = useState<{ used: number; total: number } | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const lastFixTimeRef = useRef<number | null>(null);
  const wakeLockSentinelRef = useRef<WakeLockSentinel | null>(null);
  const nativeAndroid = isNativeAndroid();

  useEffect(() => {
    if (!nativeAndroid) return;
    return subscribeNativeState((snap) => {
      if (typeof snap.gnssSatellitesTotal === 'number' && snap.gnssSatellitesTotal > 0) {
        setSatInfo({
          used: snap.gnssSatellitesUsed ?? 0,
          total: snap.gnssSatellitesTotal,
        });
      }
      if (snap.running) {
        if (snap.accuracyMeters !== null && snap.latitude !== null && snap.longitude !== null) {
          if (startTimeRef.current !== null) {
            setLockDurationMs(Math.round(performance.now() - startTimeRef.current));
            startTimeRef.current = null;
          }
          const fixTime = snap.lastFixTimeMs ?? Date.now();
          if (lastFixTimeRef.current !== fixTime) {
            lastFixTimeRef.current = fixTime;
            setUpdateCount((prev) => prev + 1);
          }
          setReading({
            latitude: snap.latitude,
            longitude: snap.longitude,
            accuracy: snap.accuracyMeters,
            altitude: snap.altitude,
            speed: snap.speedKmh !== null ? snap.speedKmh / 3.6 : null,
            heading: null,
            timestamp: fixTime,
          });
          setStatus('active');
        } else {
          setStatus('acquiring');
        }
      } else {
        setStatus('idle');
      }
    });
  }, [nativeAndroid]);

  const stopGpsWatch = () => {
    if (isNativeAndroid()) {
      window.NativeAndroidBridge?.stopKeepAlive();
      setStatus('idle');
      return;
    }
    if (watchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setStatus('idle');
  };

  const startGpsWatch = () => {
    if (isNativeAndroid()) {
      setStatus('acquiring');
      setErrorMessage(null);
      startTimeRef.current = performance.now();
      window.NativeAndroidBridge?.startKeepAlive();
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus('error');
      setErrorMessage('مرورگر شما از Geolocation API پشتیبانی نمی‌کند.');
      return;
    }

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    setStatus('acquiring');
    setErrorMessage(null);
    startTimeRef.current = performance.now();

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        if (startTimeRef.current !== null) {
          setLockDurationMs(Math.round(performance.now() - startTimeRef.current));
          startTimeRef.current = null;
        }
        setReading({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          altitude: pos.coords.altitude,
          speed: pos.coords.speed,
          heading: pos.coords.heading,
          timestamp: pos.timestamp,
        });
        setUpdateCount((prev) => prev + 1);
        setStatus('active');
        setErrorMessage(null);
      },
      (err) => {
        setStatus('error');
        if (err.code === err.PERMISSION_DENIED) {
          setErrorMessage('دسترسی موقعیت مکانی (Location) مسدود شده است. از تنظیمات مرورگر اجازه دسترسی بدهید.');
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setErrorMessage('سیگنال GPS در دسترس نیست. مطمئن شوید GPS گوشی روشن است و در فضای باز هستید.');
        } else if (err.code === err.TIMEOUT) {
          setErrorMessage('زمان دریافت قفل اولیه GPS به پایان رسید. دوباره تلاش کنید.');
        } else {
          setErrorMessage(err.message || 'خطا در دریافت اطلاعات موقعیت.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      },
    );
  };

  useEffect(() => {
    if (autoStartTrigger > 0) {
      startGpsWatch();
    }
  }, [autoStartTrigger]);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (wakeLockSentinelRef.current) {
        wakeLockSentinelRef.current.release().catch(() => {});
      }
    };
  }, []);

  const toggleWakeLock = async () => {
    if (!wakeLockSupported) {
      setWakeLockNote('مرورگر فعلی از Screen Wake Lock پشتیبانی نمی‌کند.');
      return;
    }

    if (wakeLockActive && wakeLockSentinelRef.current) {
      await wakeLockSentinelRef.current.release().catch(() => {});
      wakeLockSentinelRef.current = null;
      setWakeLockActive(false);
      setWakeLockNote('قفل بیدار ماندن صفحه غیرفعال شد.');
      return;
    }

    try {
      const sentinel = await navigator.wakeLock.request('screen');
      wakeLockSentinelRef.current = sentinel;
      setWakeLockActive(true);
      setWakeLockNote('صفحه نمایش تا زمان باز بودن این صفحه روشن می‌ماند تا GPS متوقف نشود.');
      sentinel.addEventListener('release', () => {
        setWakeLockActive(false);
        wakeLockSentinelRef.current = null;
      });
    } catch {
      setWakeLockActive(false);
      setWakeLockNote('امکان فعال‌سازی Wake Lock در این حالت مرورگر وجود نداشت.');
    }
  };

  const handleCopyCoords = async () => {
    if (!reading) return;
    const text = `${reading.latitude.toFixed(6)}, ${reading.longitude.toFixed(6)}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCoords(true);
      window.setTimeout(() => setCopiedCoords(false), 1800);
    } catch {
      // Clipboard blocked in non-secure context
    }
  };

  const quality = reading ? classifyGpsAccuracy(reading.accuracy) : null;

  const qualityTextColor =
    quality?.level === 'excellent'
      ? 'text-teal-700'
      : quality?.level === 'good'
        ? 'text-emerald-700'
        : quality?.level === 'fair'
          ? 'text-amber-700'
          : 'text-rose-700';

  const qualityBarColor =
    quality?.level === 'excellent'
      ? 'bg-teal-600'
      : quality?.level === 'good'
        ? 'bg-emerald-600'
        : quality?.level === 'fair'
          ? 'bg-amber-500'
          : 'bg-rose-600';

  return (
    <section
      id="gps-monitor"
      aria-labelledby="gps-monitor-heading"
      className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between gap-6"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <span>{nativeAndroid ? 'سرویس بومی اندروید' : 'سنسور واقعی مرورگر'}</span>
              <span aria-hidden="true">·</span>
              <span>{nativeAndroid ? 'LocationManager + A-GPS' : 'Geolocation High Accuracy'}</span>
            </div>
            <h2 id="gps-monitor-heading" className="text-xl font-bold text-slate-900">
              پایشگر زنده دقت GPS
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {status === 'active' || status === 'acquiring' ? (
              <button
                type="button"
                onClick={stopGpsWatch}
                className="min-h-[44px] px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                توقف GPS
              </button>
            ) : (
              <button
                type="button"
                onClick={startGpsWatch}
                className="min-h-[44px] px-4 py-2 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <LocateFixed className="w-4 h-4" aria-hidden="true" />
                <span>دریافت موقعیت زنده</span>
              </button>
            )}
          </div>
        </div>

        {status === 'idle' && !reading && (
          <div className="bg-slate-50 rounded-xl p-5 text-sm text-slate-600 space-y-2">
            <p className="font-medium text-slate-800">آماده سنجش دقت واقعی گیرنده GPS دستگاه شما</p>
            <p className="leading-relaxed">
              با زدن دکمه «دریافت موقعیت زنده»، مرورگر با حالت دقت بالا (High Accuracy) مختصات، شعاع خطای فعلی به متر، سرعت حرکت و زمان قفل اولیه را مستقیماً از سخت‌افزار گوشی یا سیستم می‌خواند.
            </p>
          </div>
        )}

        {status === 'acquiring' && !reading && (
          <div className="bg-teal-50/70 rounded-xl p-5 flex items-center gap-3 text-sm text-teal-900">
            <RefreshCw className="w-5 h-5 animate-spin text-teal-700 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-semibold">در حال برقراری ارتباط با سرویس موقعیت‌یابی...</p>
              <p className="text-teal-800 mt-0.5">در صورت نمایش پیام مرورگر، دسترسی Location را تأیید کنید.</p>
            </div>
          </div>
        )}

        {status === 'error' && errorMessage && (
          <div role="alert" className="bg-rose-50 rounded-xl p-4 flex items-start gap-3 text-sm text-rose-900">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-1">
              <p className="font-semibold">خطا در خواندن GPS</p>
              <p className="text-rose-800 leading-relaxed">{errorMessage}</p>
            </div>
          </div>
        )}

        {reading && quality && (
          <div className="space-y-5">
            <div className="bg-slate-50 rounded-xl p-4 space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <span className="text-xs text-slate-500 block">شعاع خطای فعلی GPS</span>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-3xl font-bold text-slate-900 font-mono tabular-nums">
                      ±{Math.round(reading.accuracy)}
                    </span>
                    <span className="text-sm font-medium text-slate-600">متر</span>
                  </div>
                </div>
                <div className="text-left">
                  <span className={`text-sm font-bold ${qualityTextColor}`}>{quality.label}</span>
                  <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                    به‌روزرسانی شماره {updateCount}
                  </p>
                </div>
              </div>

              <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden" aria-hidden="true">
                <div
                  className={`h-full transition-all duration-300 ${qualityBarColor}`}
                  style={{ width: `${quality.scorePercent}%` }}
                />
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">{quality.description}</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-50 rounded-xl p-3">
                <span className="text-xs text-slate-500 block">عرض جغرافیایی</span>
                <span className="text-sm font-semibold font-mono tabular-nums text-slate-900 mt-1 block" dir="ltr">
                  {formatCoordinate(reading.latitude, 5)}
                </span>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <span className="text-xs text-slate-500 block">طول جغرافیایی</span>
                <span className="text-sm font-semibold font-mono tabular-nums text-slate-900 mt-1 block" dir="ltr">
                  {formatCoordinate(reading.longitude, 5)}
                </span>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <span className="text-xs text-slate-500 block">سرعت لحظه‌ای</span>
                <span className="text-sm font-semibold font-mono tabular-nums text-slate-900 mt-1 block">
                  {formatSpeedKmh(reading.speed)} <span className="text-xs font-sans text-slate-500">km/h</span>
                </span>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <span className="text-xs text-slate-500 block">زمان قفل اولیه</span>
                <span className="text-sm font-semibold font-mono tabular-nums text-slate-900 mt-1 block">
                  {lockDurationMs !== null ? `${(lockDurationMs / 1000).toFixed(1)} ثانیه` : '—'}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 pt-1">
              <div className="flex flex-wrap items-center gap-2">
                <Compass className="w-4 h-4 text-slate-400" aria-hidden="true" />
                <span>
                  ارتفاع: <strong className="text-slate-700 font-mono tabular-nums">{reading.altitude !== null ? `${Math.round(reading.altitude)}m` : 'نامشخص'}</strong>
                </span>
                {satInfo && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>
                      ماهواره: <strong className="text-slate-700 font-mono tabular-nums">{satInfo.used}/{satInfo.total}</strong>
                    </span>
                  </>
                )}
                <span aria-hidden="true">·</span>
                <span>
                  آخرین ثبت: <strong className="text-slate-700 font-mono tabular-nums">{new Date(reading.timestamp).toLocaleTimeString('fa-IR')}</strong>
                </span>
              </div>

              <button
                type="button"
                onClick={handleCopyCoords}
                className="min-h-[36px] px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                {copiedCoords ? <Check className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" /> : <Copy className="w-3.5 h-3.5" aria-hidden="true" />}
                <span>{copiedCoords ? 'مختصات کپی شد' : 'کپی مختصات'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-slate-100 pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <p className="text-sm font-semibold text-slate-800">جلوگیری از خواب رفتن صفحه و GPS</p>
          <p className="text-xs text-slate-500 leading-relaxed">
            {wakeLockNote || 'صفحه حین انتظار روشن می‌ماند تا سیستم‌عامل GPS را متوقف نکند.'}
          </p>
        </div>

        <button
          type="button"
          onClick={toggleWakeLock}
          aria-pressed={wakeLockActive}
          className={`min-h-[44px] px-4 py-2 text-xs font-semibold rounded-xl border transition-colors flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
            wakeLockActive
              ? 'bg-teal-50 border-teal-300 text-teal-800 hover:bg-teal-100'
              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          {wakeLockActive ? <Lock className="w-4 h-4 text-teal-700" aria-hidden="true" /> : <Unlock className="w-4 h-4 text-slate-500" aria-hidden="true" />}
          <span>{wakeLockActive ? 'صفحه بیدار است' : 'بیدار نگه‌داشتن صفحه'}</span>
        </button>
      </div>
    </section>
  );
}
