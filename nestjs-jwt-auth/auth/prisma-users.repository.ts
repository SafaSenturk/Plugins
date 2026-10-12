// Prisma ile UsersRepository. Şemada şu model olmalı:
//   model User { id String @id @default(cuid())  email String @unique  password String
//                name String  role Role @default(CUSTOMER)  createdAt DateTime @default(now()) … }
// PrismaService yolunu kendi projenize göre düzeltin.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser, UsersRepository } from './users.repository';

@Injectable()
export class PrismaUsersRepository extends UsersRepository {
  constructor(private prisma: PrismaService) { super(); }

  findByEmail(email: string) { return this.prisma.user.findUnique({ where: { email } }) as Promise<AuthUser | null>; }
  findById(id: string) { return this.prisma.user.findUnique({ where: { id } }) as Promise<AuthUser | null>; }
  create(data: { email: string; password: string; name: string }) { return this.prisma.user.create({ data }) as Promise<AuthUser>; }
  update(id: string, data: { name?: string; password?: string }) { return this.prisma.user.update({ where: { id }, data }) as Promise<AuthUser>; }
}
