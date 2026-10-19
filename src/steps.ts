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

/** Total steps for each day key, or null if Health Connect can't be read. */
export async function readSteps(keys: string[]): Promise<number[] | null> {
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
        });
        return r.COUNT_TOTAL ?? 0;
      }),
    );
  } catch {
    return null;
  }
}

/** Steps for the given days; refreshes when the app comes back to the foreground. */
export function useSteps(keys: string[], enabled: boolean) {
  const [steps, setSteps] = useState<number[] | null>(null);
  const id = keys.join(',');
  useEffect(() => {
    if (!enabled) {
      setSteps(null);
      return;
    }
    let live = true;
    const load = () => readSteps(id.split(',')).then((r) => live && setSteps(r));
    load();
    const sub = AppState.addEventListener('change', (st) => st === 'active' && load());
    const timer = setInterval(load, 60000);
    return () => {
      live = false;
      sub.remove();
      clearInterval(timer);
    };
  }, [id, enabled]);
  return steps;
}
