import { useEffect, useRef } from 'react';

/**
 * Lance `tick` au montage puis toutes les `intervalMs`. Le tick est mis en
 * pause quand l'onglet est caché (document.hidden), et relancé immédiatement
 * au retour pour rafraîchir la vue.
 */
export function usePolling(tick: () => void, intervalMs: number): void {
  const tickRef = useRef(tick);
  tickRef.current = tick;

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const run = () => {
      if (cancelled || document.hidden) return;
      tickRef.current();
      timer = setTimeout(run, intervalMs);
    };

    const onVisibility = () => {
      if (cancelled) return;
      if (document.hidden) {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
      } else if (!timer) {
        run();
      }
    };

    run();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [intervalMs]);
}
