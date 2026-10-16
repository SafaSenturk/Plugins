// JWT_SECRET yoksa uygulama AÇILMAZ. Eski koddaki gibi 'secret'e düşmek,
// herkesin kendine admin token'ı imzalayabilmesi demektir.
export function jwtSecret(): string {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) {
    throw new Error('JWT_SECRET ortam değişkeni en az 32 karakter olmalı (ör. `openssl rand -base64 48`)');
  }
  return s;
}
