import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { parseKey } from './domain';

/**
 * Steps come from Health Connect, the Android store where the Google Fit app (and Samsung Health,
 * Fitbit, …) write their data. The old Google Fit APIs shut down at the end of 2026.
 * Only loaded on Android: the native module does not exist on web.
 */
type HC = typeof import('react-native-health-connect');
const hc = (): HC | null => (Platform.OS === 'android' ? (require('react-native-health-connect') as HC) : null);

export type EnableResult = 'ok' | 'unavailable' | 'denied';

export async function enableSteps(): Promise<EnableResult> {
  const m = hc();
  if (!m) return 'unavailable';
  try {
    const status = await m.getSdkStatus();
    if (status !== m.SdkAvailabilityStatus.SDK_AVAILABLE) return 'unavailable';
    if (!(await m.initialize())) return 'unavailable';
    const granted = await m.requestPermission([{ accessType: 'read', recordType: 'Steps' }]);
    return granted.some((p) => 'recordType' in p && p.recordType === 'Steps') ? 'ok' : 'denied';
  } catch {
    return 'unavailable';
  }
}

export const SOURCE_NAMES: Record<string, string> = {
  'com.google.android.apps.fitness': 'Google Fit',
  'com.google.android.apps.healthdata': 'Health Connect',
  'com.google.android.gms': 'Google (Play services)',
  'com.fitbit.FitbitMobile': 'Fitbit / Google Health',
  'com.mi.health': 'Mi Fitness',
  'com.xiaomi.wearable': 'Mi Fitness (Xiaomi Wear)',
  'com.sec.android.app.shealth': 'Samsung Health',
};
export const sourceName = (pkg: string) => (pkg === 'all' ? 'All sources' : SOURCE_NAMES[pkg] ?? pkg);

/** Apps that wrote step data in the last 30 days (Health Connect package names). */
export async function listStepSources(): Promise<string[]> {
  const m = hc();
  if (!m) return [];
  try {
    if (!(await m.initialize())) return [];
    const end = new Date();
    const start = new Date(end.getTime() - 30 * 86400000);
    const r = await m.aggregateRecord({ recordType: 'Steps', timeRangeFilter: { operator: 'between', startTime: start.toISOString(), endTime: end.toISOString() } });
    return [...(r.dataOrigins ?? [])];
  } catch {
    return [];
  }
}

/** Total steps for each day key, or null if Health Connect can't be read. source: 'all' or a package name. */
export async function readSteps(keys: string[], source: string = 'all'): Promise<number[] | null> {
  const m = hc();
  if (!m) return null;
  try {
    if (!(await m.initialize())) return null;
    return await Promise.all(
      keys.map(async (k) => {
        const s = parseKey(k);
        const e = new Date(s.getFullYear(), s.getMonth(), s.getDate() + 1);
        const r = await m.aggregateRecord({
          recordType: 'Steps',
          timeRangeFilter: { operator: 'between', startTime: s.toISOString(), endTime: e.toISOString() },
          ...(source !== 'all' ? { dataOriginFilter: [source] } : {}),
        });
        return r.COUNT_TOTAL ?? 0;
      }),
    );
  } catch {
    return null;
  }
}

/** Steps for the given days; refreshes when the app comes back to the foreground. */
export function useSteps(keys: string[], enabled: boolean, source: string = 'all') {
  const [steps, setSteps] = useState<number[] | null>(null);
  const id = keys.join(',');
  useEffect(() => {
    if (!enabled) {
      setSteps(null);
      return;
    }
    let live = true;
    const load = () => readSteps(id.split(','), source).then((r) => live && setSteps(r));
    load();
    const sub = AppState.addEventListener('change', (st) => st === 'active' && load());
    const timer = setInterval(load, 60000);
    return () => {
      live = false;
      sub.remove();
      clearInterval(timer);
    };
  }, [id, enabled, source]);
  return steps;
}
