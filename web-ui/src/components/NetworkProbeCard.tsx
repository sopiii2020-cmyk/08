import { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, Play, Square, RotateCcw, Wifi, WifiOff } from 'lucide-react';
import { computeNetworkStats, type PingSample } from '../utils/diagnostics';
import { isNativeAndroid, subscribeNativeState } from '../utils/nativeBridge';

interface NetworkInformationLike {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
}

function getNavigatorConnection(): NetworkInformationLike | null {
  if (typeof navigator === 'undefined') return null;
  const nav = navigator as Navigator & { connection?: NetworkInformationLike };
  return nav.connection ?? null;
}

interface NetworkProbeCardProps {
  autoStartTrigger?: number;
}

export function NetworkProbeCard({ autoStartTrigger = 0 }: NetworkProbeCardProps) {
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
  const [samples, setSamples] = useState<PingSample[]>([]);
  const [isProbing, setIsProbing] = useState(false);
  const [isAutoPolling, setIsAutoPolling] = useState(false);
  const [connInfo, setConnInfo] = useState<NetworkInformationLike | null>(() => getNavigatorConnection());
  const [nativeNetworkLabel, setNativeNetworkLabel] = useState<string | null>(null);

  const nextIdRef = useRef(1);
  const intervalRef = useRef<number | null>(null);
  const nativeAndroid = isNativeAndroid();

  useEffect(() => {
    if (!nativeAndroid) return;
    return subscribeNativeState((snap) => {
      setNativeNetworkLabel(snap.networkLabel);
      setIsOnline(!snap.networkLabel.includes('بدون') && !snap.networkLabel.includes('قطع'));
      if (Array.isArray(snap.pingHistory)) {
        setSamples(snap.pingHistory);
      }
      setIsAutoPolling(snap.running);
      setIsProbing(false);
    });
  }, [nativeAndroid]);

  const runSingleProbe = useCallback(async () => {
    if (isNativeAndroid()) {
      setIsProbing(true);
      window.NativeAndroidBridge?.runPingNow();
      return;
    }

    const id = nextIdRef.current;
    nextIdRef.current += 1;

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsOnline(false);
      setSamples((prev) => [...prev.slice(-19), { id, timestamp: Date.now(), latencyMs: null, ok: false }]);
      return;
    }

    setIsProbing(true);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 5000);
    const start = performance.now();

    try {
      const response = await fetch(`/?probe=${Date.now()}`, {
        method: 'HEAD',
        cache: 'no-store',
        signal: controller.signal,
      });
      const elapsed = Math.max(1, Math.round(performance.now() - start));
      window.clearTimeout(timeoutId);
      setIsOnline(true);
      setSamples((prev) => [
        ...prev.slice(-19),
        { id, timestamp: Date.now(), latencyMs: response.ok ? elapsed : null, ok: response.ok },
      ]);
    } catch {
      window.clearTimeout(timeoutId);
      setSamples((prev) => [...prev.slice(-19), { id, timestamp: Date.now(), latencyMs: null, ok: false }]);
    } finally {
      setIsProbing(false);
      setConnInfo(getNavigatorConnection());
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const conn = getNavigatorConnection();
    const handleConnChange = () => setConnInfo({ ...getNavigatorConnection() });
    conn?.addEventListener?.('change', handleConnChange);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      conn?.removeEventListener?.('change', handleConnChange);
    };
  }, []);

  useEffect(() => {
    if (isNativeAndroid()) return;
    if (isAutoPolling) {
      runSingleProbe();
      intervalRef.current = window.setInterval(runSingleProbe, 2000);
    } else if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isAutoPolling, runSingleProbe]);

  useEffect(() => {
    if (autoStartTrigger > 0) {
      if (isNativeAndroid()) {
        window.NativeAndroidBridge?.startKeepAlive();
      } else {
        setIsAutoPolling(true);
      }
    }
  }, [autoStartTrigger]);

  const stats = computeNetworkStats(samples, isOnline);

  const statusTone =
    stats.statusLevel === 'stable'
      ? 'text-teal-700'
      : stats.statusLevel === 'moderate'
        ? 'text-amber-700'
        : stats.statusLevel === 'unstable' || stats.statusLevel === 'offline'
          ? 'text-rose-700'
          : 'text-slate-600';

  const maxChartLatency = Math.max(
    120,
    ...samples.map((s) => (s.ok && s.latencyMs !== null ? s.latencyMs : 0)),
  );

  return (
    <section
      id="network-probe"
      aria-labelledby="network-probe-heading"
      className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between gap-6"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <span>سنجش واقعی تاخیر و افت اتصال</span>
              <span aria-hidden="true">·</span>
              <span>{nativeAndroid ? 'TCP Keep-Alive (1.1.1.1 / 8.8.8.8)' : 'HTTP RTT & Jitter'}</span>
            </div>
            <h2 id="network-probe-heading" className="text-xl font-bold text-slate-900">
              تست پایداری اینترنت
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={runSingleProbe}
              disabled={isProbing}
              className="min-h-[44px] px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-60 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isProbing ? 'در حال سنجش...' : 'تست پینگ'}
            </button>
            <button
              type="button"
              onClick={() => {
                if (nativeAndroid) {
                  if (isAutoPolling) {
                    window.NativeAndroidBridge?.stopKeepAlive();
                  } else {
                    window.NativeAndroidBridge?.startKeepAlive();
                  }
                } else {
                  setIsAutoPolling((prev) => !prev);
                }
              }}
              aria-pressed={isAutoPolling}
              className={`min-h-[44px] px-4 py-2 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                isAutoPolling
                  ? 'bg-rose-600 hover:bg-rose-700 text-white'
                  : 'bg-teal-700 hover:bg-teal-800 text-white'
              }`}
            >
              {isAutoPolling ? (
                <>
                  <Square className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>توقف پایش</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>پایش مداوم</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="bg-slate-50 rounded-xl p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {isOnline ? (
                <Wifi className="w-4 h-4 text-teal-700" aria-hidden="true" />
              ) : (
                <WifiOff className="w-4 h-4 text-rose-600" aria-hidden="true" />
              )}
              <span className={`text-sm font-bold ${statusTone}`}>{stats.statusLabel}</span>
            </div>

            <div className="text-xs text-slate-500 flex items-center gap-2">
              <span>تعداد نمونه: <strong className="font-mono tabular-nums text-slate-700">{stats.totalCount}</strong></span>
              {samples.length > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <button
                    type="button"
                    onClick={() => setSamples([])}
                    className="text-slate-600 hover:text-slate-900 underline-offset-2 hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" aria-hidden="true" />
                    <span>پاک کردن</span>
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl p-3">
              <span className="text-xs text-slate-500 block">میانگین پینگ</span>
              <span className="text-lg font-bold font-mono tabular-nums text-slate-900 mt-0.5 block">
                {stats.avgLatencyMs !== null ? `${stats.avgLatencyMs} ms` : '—'}
              </span>
            </div>
            <div className="bg-white rounded-xl p-3">
              <span className="text-xs text-slate-500 block">نوسان (Jitter)</span>
              <span className="text-lg font-bold font-mono tabular-nums text-slate-900 mt-0.5 block">
                {stats.jitterMs !== null ? `${stats.jitterMs} ms` : '—'}
              </span>
            </div>
            <div className="bg-white rounded-xl p-3">
              <span className="text-xs text-slate-500 block">نرخ افت (Loss)</span>
              <span className={`text-lg font-bold font-mono tabular-nums mt-0.5 block ${stats.lossPercent > 0 ? 'text-rose-700' : 'text-slate-900'}`}>
                {samples.length > 0 ? `${stats.lossPercent}%` : '—'}
              </span>
            </div>
            <div className="bg-white rounded-xl p-3">
              <span className="text-xs text-slate-500 block">بازه کمینه / بیشینه</span>
              <span className="text-sm font-semibold font-mono tabular-nums text-slate-900 mt-1 block" dir="ltr">
                {stats.minLatencyMs !== null && stats.maxLatencyMs !== null
                  ? `${stats.minLatencyMs} – ${stats.maxLatencyMs} ms`
                  : '—'}
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>نمودار نوسان ۲۰ نمونه اخیر</span>
              <span className="font-mono tabular-nums">سقف مقیاس: {maxChartLatency} ms</span>
            </div>
            <div className="h-20 bg-white rounded-xl px-3 py-2 flex items-end gap-1.5" role="img" aria-label="نمودار میله‌ای تاخیر شبکه">
              {samples.length === 0 ? (
                <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
                  برای مشاهده نمودار واقعی نوسان اینترنت، تست پینگ یا پایش مداوم را بزنید.
                </div>
              ) : (
                samples.map((sample) => {
                  const heightPercent = sample.ok && sample.latencyMs !== null
                    ? Math.max(12, Math.min(100, Math.round((sample.latencyMs / maxChartLatency) * 100)))
                    : 100;
                  const barClass = !sample.ok
                    ? 'bg-rose-500'
                    : (sample.latencyMs ?? 0) > 250
                      ? 'bg-amber-500'
                      : 'bg-teal-600';
                  return (
                    <div
                      key={sample.id}
                      title={sample.ok && sample.latencyMs !== null ? `${sample.latencyMs} ms` : 'قطع / تایم‌اوت'}
                      className="flex-1 h-full flex items-end"
                    >
                      <div
                        className={`w-full rounded-t-sm transition-all duration-200 ${barClass}`}
                        style={{ height: `${heightPercent}%` }}
                      />
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-100 pt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
        <div className="flex flex-wrap items-center gap-2">
          <Activity className="w-4 h-4 text-slate-400" aria-hidden="true" />
          <span>
            نوع شبکه: <strong className="text-slate-700 font-mono">{nativeNetworkLabel ?? (connInfo?.effectiveType ? connInfo.effectiveType.toUpperCase() : 'نامشخص')}</strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            پهنای باند تخمینی: <strong className="text-slate-700 font-mono tabular-nums">{connInfo?.downlink !== undefined ? `${connInfo.downlink} Mbps` : 'نامشخص'}</strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            RTT مرورگر: <strong className="text-slate-700 font-mono tabular-nums">{connInfo?.rtt !== undefined ? `${connInfo.rtt} ms` : 'نامشخص'}</strong>
          </span>
        </div>
      </div>
    </section>
  );
}
