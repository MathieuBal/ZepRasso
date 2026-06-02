// Miroir TS des helpers temps de server/lib.mjs (parseTimeStr / formatMs).
// Garder synchro avec le serveur si la grammaire évolue.

export function parseTimeStr(s: string | null | undefined): number | null {
  if (s === null || s === undefined) return null;
  const str = String(s).trim();
  if (!str) return null;
  const m = /^(\d+):(\d{1,2})(?:[.,](\d{1,3}))?$/.exec(str);
  if (m) {
    const min = parseInt(m[1], 10);
    const sec = parseInt(m[2], 10);
    if (sec >= 60) return null;
    const msStr = m[3] || '0';
    const ms = parseInt(msStr.padEnd(3, '0'), 10);
    return min * 60_000 + sec * 1000 + ms;
  }
  const m2 = /^(\d+)(?:[.,](\d{1,3}))?$/.exec(str);
  if (m2) {
    const sec = parseInt(m2[1], 10);
    const msStr = m2[2] || '0';
    const ms = parseInt(msStr.padEnd(3, '0'), 10);
    return sec * 1000 + ms;
  }
  return null;
}

export function formatMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(Number(ms))) return '';
  const total = Math.max(0, Math.floor(Number(ms)));
  const min = Math.floor(total / 60_000);
  const sec = Math.floor((total % 60_000) / 1000);
  const milli = total % 1000;
  return `${min}:${String(sec).padStart(2, '0')}.${String(milli).padStart(3, '0')}`;
}

// Écart par rapport à un temps de référence, format "+0.342s" ou "+1.234s".
export function formatGap(timeMs: number, refMs: number): string {
  const delta = (timeMs - refMs) / 1000;
  return `+${delta.toFixed(3)}s`;
}
