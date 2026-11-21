export type GpsQualityLevel = 'excellent' | 'good' | 'fair' | 'poor';

export interface GpsQualitySummary {
  level: GpsQualityLevel;
  label: string;
  description: string;
  scorePercent: number;
}

export interface PingSample {
  id: number;
  timestamp: number;
  latencyMs: number | null;
  ok: boolean;
}

export interface NetworkStats {
  totalCount: number;
  successCount: number;
  lossPercent: number;
  avgLatencyMs: number | null;
  minLatencyMs: number | null;
  maxLatencyMs: number | null;
  jitterMs: number | null;
  statusLabel: string;
  statusLevel: 'stable' | 'moderate' | 'unstable' | 'offline' | 'idle';
}

export function classifyGpsAccuracy(accuracyMeters: number): GpsQualitySummary {
  if (!Number.isFinite(accuracyMeters) || accuracyMeters < 0) {
    return {
      level: 'poor',
      label: 'نامعتبر',
      description: 'مقدار دقت دریافتی معتبر نیست.',
      scorePercent: 0,
    };
  }

  if (accuracyMeters <= 12) {
    return {
      level: 'excellent',
      label: 'دقت عالی',
      description: 'قفل ماهواره‌ای بسیار دقیق و مناسب مسیریابی و ثبت نقطه سوارشدن.',
      scorePercent: 95,
    };
  }

  if (accuracyMeters <= 30) {
    return {
      level: 'good',
      label: 'دقت خوب',
      description: 'دقت پایدار برای حرکت در شهر و دریافت درخواست‌های اطراف.',
      scorePercent: 78,
    };
  }

  if (accuracyMeters <= 75) {
    return {
      level: 'fair',
      label: 'دقت متوسط',
      description: 'خطای مکانی متوسط؛ بهتر است در فضای باز یا کنار شیشه خودرو بمانید.',
      scorePercent: 52,
    };
  }

  return {
    level: 'poor',
    label: 'دقت ضعیف',
    description: 'موقعیت‌یابی احتمالاً فقط بر پایه دکل یا وای‌فای است؛ GPS دستگاه را بررسی کنید.',
    scorePercent: 25,
  };
}

export function formatSpeedKmh(speedMetersPerSec: number | null | undefined): string {
  if (speedMetersPerSec === null || speedMetersPerSec === undefined || !Number.isFinite(speedMetersPerSec) || speedMetersPerSec < 0) {
    return '—';
  }
  const kmh = Math.round(speedMetersPerSec * 3.6);
  return `${kmh}`;
}

export function formatCoordinate(value: number | null | undefined, digits = 5): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '—';
  }
  return value.toFixed(digits);
}

export function computeNetworkStats(samples: PingSample[], isOnline: boolean): NetworkStats {
  if (!isOnline) {
    return {
      totalCount: samples.length,
      successCount: samples.filter((s) => s.ok).length,
      lossPercent: samples.length > 0 ? Math.round((samples.filter((s) => !s.ok).length / samples.length) * 100) : 100,
      avgLatencyMs: null,
      minLatencyMs: null,
      maxLatencyMs: null,
      jitterMs: null,
      statusLabel: 'آفلاین',
      statusLevel: 'offline',
    };
  }

  if (samples.length === 0) {
    return {
      totalCount: 0,
      successCount: 0,
      lossPercent: 0,
      avgLatencyMs: null,
      minLatencyMs: null,
      maxLatencyMs: null,
      jitterMs: null,
      statusLabel: 'آماده سنجش',
      statusLevel: 'idle',
    };
  }

  const successful = samples.filter((s) => s.ok && s.latencyMs !== null);
  const totalCount = samples.length;
  const successCount = successful.length;
  const lossPercent = Math.round(((totalCount - successCount) / totalCount) * 100);

  if (successful.length === 0) {
    return {
      totalCount,
      successCount: 0,
      lossPercent: 100,
      avgLatencyMs: null,
      minLatencyMs: null,
      maxLatencyMs: null,
      jitterMs: null,
      statusLabel: 'عدم پاسخ شبکه',
      statusLevel: 'unstable',
    };
  }

  const latencies = successful.map((s) => s.latencyMs as number);
  const sum = latencies.reduce((acc, v) => acc + v, 0);
  const avgLatencyMs = Math.round(sum / latencies.length);
  const minLatencyMs = Math.round(Math.min(...latencies));
  const maxLatencyMs = Math.round(Math.max(...latencies));

  let jitterMs = 0;
  if (latencies.length > 1) {
    let diffSum = 0;
    for (let i = 1; i < latencies.length; i += 1) {
      diffSum += Math.abs(latencies[i] - latencies[i - 1]);
    }
    jitterMs = Math.round(diffSum / (latencies.length - 1));
  }

  let statusLevel: NetworkStats['statusLevel'] = 'stable';
  let statusLabel = 'پایدار';

  if (lossPercent >= 15 || avgLatencyMs > 450 || jitterMs > 120) {
    statusLevel = 'unstable';
    statusLabel = 'ناپایدار (دارای افت یا نوسان بالا)';
  } else if (lossPercent > 0 || avgLatencyMs > 200 || jitterMs > 45) {
    statusLevel = 'moderate';
    statusLabel = 'متوسط (نوسان خفیف)';
  }

  return {
    totalCount,
    successCount,
    lossPercent,
    avgLatencyMs,
    minLatencyMs,
    maxLatencyMs,
    jitterMs,
    statusLabel,
    statusLevel,
  };
}

export function computeChecklistProgress(itemIds: string[], completedIds: Set<string>): {
  completedCount: number;
  totalCount: number;
  percent: number;
} {
  const totalCount = itemIds.length;
  if (totalCount === 0) {
    return { completedCount: 0, totalCount: 0, percent: 0 };
  }
  const completedCount = itemIds.filter((id) => completedIds.has(id)).length;
  const percent = Math.round((completedCount / totalCount) * 100);
  return { completedCount, totalCount, percent };
}
