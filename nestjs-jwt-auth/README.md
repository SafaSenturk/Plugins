# nestjs-jwt-auth

NestJS için e-posta + şifre ile kayıt/giriş, JWT ve rol kontrolü. ecommerce-backend'deki
`auth` modülünden çıkarıldı ve sağlamlaştırıldı.

`auth/` klasörünü projenizin `src/` altına kopyalayın.

## Paketler
```
npm i @nestjs/jwt @nestjs/passport passport passport-jwt bcryptjs
npm i -D @types/passport-jwt @types/bcryptjs
```

## Bağlama
```ts
// app.module.ts
import { AuthModule } from './auth/auth.module';
import { PrismaUsersRepository } from './auth/prisma-users.repository';
import { PrismaModule } from './prisma/prisma.module';

@Module({ imports: [AuthModule.forRoot({ users: PrismaUsersRepository, imports: [PrismaModule] })] })
export class AppModule {}
```
`.env` → `JWT_SECRET=` en az 32 karakter (`openssl rand -base64 48`).

## Uç noktalar
| | |
|---|---|
| `POST /auth/register` | `{ email, password, name }` → `{ token, user }` |
| `POST /auth/login` | `{ email, password }` → `{ token, user }` |
| `GET /auth/me` | giriş gerekli |
| `PATCH /auth/profile` | `{ name }` |
| `POST /auth/password` | `{ current, next }` |

## Korumalı rota
```ts
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Get('admin/stats')
stats(@CurrentUser() u: JwtUser) { … }
```

## Eski koda göre farklar
- **`JWT_SECRET` yoksa uygulama açılmaz.** Eski kod `'secret'` değerine düşüyordu.
  Bu değeri bilen herkes kendine ADMIN token'ı imzalayabilirdi. ecommerce-backend'de de düzeltilmeli.
- E-posta küçük harfe çevrilir ve biçimi denetlenir. Şifre en az 8 karakter olmalı.
- Girişte kullanıcı yokken de şifre karşılaştırılır. Böylece yanıt süresinden hangi e-postanın kayıtlı olduğu anlaşılamaz.
- Rol koruması (`@Roles`), `@CurrentUser()` ve şifre değiştirme eklendi.
- Veritabanı `UsersRepository` arkasında. Prisma örneği hazır, başka veritabanı da kullanılabilir.
