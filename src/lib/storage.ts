const memoryStore = new Map<string, string>();
let useMemory = false;

function probe(): void {
  try {
    const k = '__zeprasso_probe__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
  } catch {
    useMemory = true;
  }
}

probe();

export const safeStorage = {
  getItem(key: string): string | null {
    if (useMemory) return memoryStore.has(key) ? (memoryStore.get(key) as string) : null;
    try {
      return localStorage.getItem(key);
    } catch {
      useMemory = true;
      return memoryStore.has(key) ? (memoryStore.get(key) as string) : null;
    }
  },
  setItem(key: string, value: string): void {
    if (useMemory) {
      memoryStore.set(key, value);
      return;
    }
    try {
      localStorage.setItem(key, value);
    } catch {
      useMemory = true;
      memoryStore.set(key, value);
    }
  },
  removeItem(key: string): void {
    memoryStore.delete(key);
    if (useMemory) return;
    try {
      localStorage.removeItem(key);
    } catch {
      useMemory = true;
    }
  },
};

export function safeUuid(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    // ignore and fall through
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
