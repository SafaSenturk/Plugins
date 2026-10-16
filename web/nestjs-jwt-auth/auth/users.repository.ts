/**
 * Kullanıcıların nerede tutulduğu modülü ilgilendirmez: bu sınıfı kendi
 * veritabanınızla doldurun (Prisma örneği: prisma-users.repository.ts).
 */
export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  password: string;      // bcrypt özeti
  createdAt?: Date;
};

export type PublicUser = Omit<AuthUser, 'password'>;

export abstract class UsersRepository {
  abstract findByEmail(email: string): Promise<AuthUser | null>;
  abstract findById(id: string): Promise<AuthUser | null>;
  abstract create(data: { email: string; password: string; name: string }): Promise<AuthUser>;
  abstract update(id: string, data: { name?: string; password?: string }): Promise<AuthUser>;
}
