/**
 * persistent-store — localStorage'a kendini kaydeden, dinlenebilir küçük durum deposu.
 * ecommerce-saas'taki sepet/favori depolarından genelleştirildi.
 *
 * - Bağımlılık yok; React'te `useStore` ile (react.ts), başka her yerde subscribe ile.
 * - Durum her değişimde YENİ nesnedir (useSyncExternalStore bunu ister).
 * - Aynı siteyi açık diğer sekmeler de güncellenir.
 * - Sunucu tarafında (Next.js SSR) localStorage'a dokunmaz.
 */
export type Listener = () => void;

export interface Store<T> {
  get(): T;
  set(next: T | ((prev: T) => T)): void;
  reset(): void;
  subscribe(fn: Listener): () => void;
}

export interface StoreOptions<T> {
  /** Kayıtlı veri bozuk ya da eski biçimdeyse düzeltmek için */
  migrate?: (raw: unknown) => T;
  /** false: yalnızca bellekte tutar */
  persist?: boolean;
}

export function createStore<T>(key: string, initial: T, opts: StoreOptions<T> = {}): Store<T> {
  const persist = opts.persist !== false && typeof window !== "undefined";
  const listeners = new Set<Listener>();
  let state = read();

  function read(): T {
    if (!persist) return initial;
    try {
      const raw = localStorage.getItem(key);
      if (raw == null) return initial;
      const parsed: unknown = JSON.parse(raw);
      return opts.migrate ? opts.migrate(parsed) : (parsed as T);
    } catch {
      return initial;
    }
  }
  function write() {
    if (!persist) return;
    try { localStorage.setItem(key, JSON.stringify(state)); } catch { /* dolu ya da kapalı */ }
  }
  const notify = () => listeners.forEach((fn) => fn());

  if (persist) {
    window.addEventListener("storage", (e) => {
      if (e.key !== key) return;
      state = read();
      notify();
    });
  }

  return {
    get: () => state,
    set(next) {
      const value = typeof next === "function" ? (next as (p: T) => T)(state) : next;
      if (Object.is(value, state)) return;
      state = value;
      write();
      notify();
    },
    reset() { this.set(initial); },
    subscribe(fn) {
      listeners.add(fn);
      return () => { listeners.delete(fn); };
    },
  };
}
