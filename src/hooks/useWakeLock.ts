import { useEffect } from 'react';

/** Не даёт экрану погаснуть, пока открыт экран тренировки. */
export function useWakeLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const request = async () => {
      try {
        lock = await navigator.wakeLock.request('screen');
      } catch {
        /* нет разрешения — не страшно */
      }
    };
    void request();
    const onVis = () => {
      if (document.visibilityState === 'visible' && !cancelled) void request();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVis);
      void lock?.release().catch(() => {});
    };
  }, [enabled]);
}
