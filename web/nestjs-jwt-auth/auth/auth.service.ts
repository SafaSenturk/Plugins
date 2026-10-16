import { BadRequestException, ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuthUser, PublicUser, UsersRepository } from './users.repository';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

export function toPublic(u: AuthUser): PublicUser {
  const { password: _omit, ...rest } = u;
  void _omit;
  return rest;
}

@Injectable()
export class AuthService {
  constructor(private users: UsersRepository, private jwt: JwtService) {}

  private sign(u: AuthUser) {
    return this.jwt.sign({ sub: u.id, email: u.email, role: u.role });
  }
  private normEmail(email: unknown) {
    const e = String(email ?? '').trim().toLowerCase();
    if (!EMAIL.test(e)) throw new BadRequestException('Geçerli bir e-posta girin');
    return e;
  }

  async register(email: unknown, password: unknown, name: unknown) {
    const e = this.normEmail(email);
    const p = String(password ?? '');
    const n = String(name ?? '').trim();
    if (p.length < MIN_PASSWORD) throw new BadRequestException(`Şifre en az ${MIN_PASSWORD} karakter olmalı`);
    if (!n) throw new BadRequestException('Adınızı yazın');
    if (await this.users.findByEmail(e)) throw new ConflictException('Bu e-posta zaten kayıtlı');

    const user = await this.users.create({ email: e, password: await bcrypt.hash(p, 10), name: n });
    return { token: this.sign(user), user: toPublic(user) };
  }

  async login(email: unknown, password: unknown) {
    const e = String(email ?? '').trim().toLowerCase();
    const user = e ? await this.users.findByEmail(e) : null;
    // kullanıcı yoksa da aynı süre ve aynı mesaj: hangi e-postaların kayıtlı olduğu sızmasın
    const ok = await bcrypt.compare(String(password ?? ''), user?.password ?? '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva');
    if (!user || !ok) throw new UnauthorizedException('E-posta veya şifre hatalı');
    return { token: this.sign(user), user: toPublic(user) };
  }

  async me(userId: string) {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundException('Kullanıcı bulunamadı');
    return toPublic(user);
  }

  async updateProfile(userId: string, data: { name?: unknown }) {
    const name = data.name === undefined ? undefined : String(data.name).trim();
    if (name === '') throw new BadRequestException('Ad boş olamaz');
    return toPublic(await this.users.update(userId, { name }));
  }

  async changePassword(userId: string, current: unknown, next: unknown) {
    const user = await this.users.findById(userId);
    if (!user || !(await bcrypt.compare(String(current ?? ''), user.password))) throw new UnauthorizedException('Mevcut şifre hatalı');
    const p = String(next ?? '');
    if (p.length < MIN_PASSWORD) throw new BadRequestException(`Şifre en az ${MIN_PASSWORD} karakter olmalı`);
    await this.users.update(userId, { password: await bcrypt.hash(p, 10) });
    return { ok: true };
  }
}
