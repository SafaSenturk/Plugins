/** React kancası: const items = useStore(cart); const count = useStore(cart, () => cart.count()); */
import { useSyncExternalStore } from "react";
import type { Store } from "./store";

export function useStore<T, S = T>(store: Store<T>, select?: (state: T) => S, serverValue?: S): S {
  const pick = () => (select ? select(store.get()) : (store.get() as unknown as S));
  return useSyncExternalStore(store.subscribe, pick, () => (serverValue !== undefined ? serverValue : pick()));
}
