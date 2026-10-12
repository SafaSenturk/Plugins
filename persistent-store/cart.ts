/** Sepet: createStore üstüne kurulu hazır örnek. */
import { createStore } from "./store";

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  oldPrice?: number;
  image?: string;
  /** Aynı ürünün farklı seçenekleri ayrı satır olsun diye (beden, renk…) */
  variant?: string;
  quantity: number;
}

const lineKey = (i: Pick<CartItem, "productId" | "variant">) => i.productId + "::" + (i.variant ?? "");

export function createCart(key = "cart", maxQty = 99) {
  const store = createStore<CartItem[]>(key, [], {
    migrate: (raw) => (Array.isArray(raw) ? (raw as CartItem[]).filter((i) => i && i.productId && i.quantity > 0) : []),
  });
  const clamp = (n: number) => Math.max(0, Math.min(maxQty, Math.floor(n)));

  return {
    ...store,
    count: () => store.get().reduce((s, i) => s + i.quantity, 0),
    total: () => store.get().reduce((s, i) => s + i.price * i.quantity, 0),
    add(item: Omit<CartItem, "quantity">, qty = 1) {
      store.set((items) => {
        const k = lineKey(item);
        const found = items.find((i) => lineKey(i) === k);
        if (found) return items.map((i) => (i === found ? { ...i, quantity: clamp(i.quantity + qty) } : i));
        return [...items, { ...item, quantity: clamp(qty) }].filter((i) => i.quantity > 0);
      });
    },
    setQty(productId: string, qty: number, variant?: string) {
      const k = lineKey({ productId, variant });
      store.set((items) => items.map((i) => (lineKey(i) === k ? { ...i, quantity: clamp(qty) } : i)).filter((i) => i.quantity > 0));
    },
    remove(productId: string, variant?: string) {
      const k = lineKey({ productId, variant });
      store.set((items) => items.filter((i) => lineKey(i) !== k));
    },
    clear: () => store.set([]),
  };
}

/** Favoriler: kimlik listesi */
export function createWishlist(key = "wishlist") {
  const store = createStore<string[]>(key, [], { migrate: (raw) => (Array.isArray(raw) ? raw.filter((x) => typeof x === "string") : []) });
  return {
    ...store,
    has: (id: string) => store.get().includes(id),
    toggle: (id: string) => store.set((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id])),
  };
}
