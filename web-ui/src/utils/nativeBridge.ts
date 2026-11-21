export interface NativeSnapshot {
  running: boolean;
  accuracyMeters: number | null;
  speedKmh: number | null;
  latitude: number | null;
  longitude: number | null;
  altitude: number | null;
  lastFixTimeMs: number | null;
  gnssSatellitesUsed?: number;
  gnssSatellitesTotal?: number;
  fineLocationGranted?: boolean;
  backgroundLocationGranted?: boolean;
  locationEnabled?: boolean;
  networkLabel: string;
  latencyMs: number | null;
  dropCount: number;
  xtraInjected: boolean;
  snappInstalled: boolean;
  ignoringBattery: boolean;
  pingHistory: Array<{
    id: number;
    timestamp: number;
    latencyMs: number | null;
    ok: boolean;
  }>;
}

export interface NativeAndroidBridgeApi {
  startServiceAndLaunchSnapp: () => void;
  startKeepAlive: () => void;
  stopKeepAlive: () => void;
  refreshAgpsXtra: () => boolean;
  requestHighAccuracyDialog?: () => void;
  openSelfLocationPermission?: () => void;
  runPingNow: () => void;
  openApnSettings: () => void;
  openLocationSettings: () => void;
  openSnappBatterySettings: () => void;
  requestIgnoreBattery: () => void;
  getStateJson: () => string;
}

declare global {
  interface Window {
    NativeAndroidBridge?: NativeAndroidBridgeApi;
    __onNativeState?: (state: NativeSnapshot) => void;
  }
}

export function isNativeAndroid(): boolean {
  return typeof window !== 'undefined' && Boolean(window.NativeAndroidBridge);
}

export function getNativeState(): NativeSnapshot | null {
  if (!isNativeAndroid() || !window.NativeAndroidBridge) return null;
  try {
    const raw = window.NativeAndroidBridge.getStateJson();
    return JSON.parse(raw) as NativeSnapshot;
  } catch {
    return null;
  }
}

const nativeListeners = new Set<(state: NativeSnapshot) => void>();

export function subscribeNativeState(listener: (state: NativeSnapshot) => void): () => void {
  if (!isNativeAndroid()) return () => {};

  if (!window.__onNativeState) {
    window.__onNativeState = (state: NativeSnapshot) => {
      nativeListeners.forEach((cb) => cb(state));
    };
  }

  nativeListeners.add(listener);
  const initial = getNativeState();
  if (initial) {
    listener(initial);
  }

  return () => {
    nativeListeners.delete(listener);
  };
}
