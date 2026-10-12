# persistent-store

Kendini localStorage'a kaydeden, dinlenebilir küçük durum deposu (TypeScript).
ecommerce-saas'taki sepet ve favori depolarından genelleştirildi. Bağımlılık yok;
React kancası isteğe bağlı.

- `store.ts`: `createStore(key, başlangıç, { migrate })`
- `cart.ts`: hazır sepet (`add`, `setQty`, `remove`, `count`, `total`) ve favoriler (`toggle`, `has`)
- `react.ts`: `useStore(store, seçici?)`

```ts
// lib/cart.ts
import { createCart, createWishlist } from "./persistent-store/cart";
export const cart = createCart();
export const wishlist = createWishlist();

// Navbar.tsx
import { useStore } from "./persistent-store/react";
const count = useStore(cart, () => cart.count(), 0);   // SSR'da 0

// Ürün sayfası
cart.add({ productId: p.id, name: p.name, price: p.price, variant: "XL" });

// React dışında
const unsub = cart.subscribe(() => console.log(cart.get()));
```

Notlar:
- Durum her değişimde yeni dizi/nesne olur; React yeniden çizer.
- Başka sekmede sepete ekleme yapılırsa bu sekme de güncellenir.
- Next.js'te sunucu çiziminde localStorage okunmaz; `useStore`'a üçüncü
  argümanla sunucu değeri verin (ör. `0`, `[]`), hidrasyon uyuşmazlığı olmaz.
- Eski sepet kodundaki adet sınırı yoktu; `createCart(key, 99)` ile sınırlanır.
