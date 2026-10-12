import { Module, Type } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard, RolesGuard } from './guards';
import { jwtSecret } from './jwt-secret';
import { JwtStrategy } from './jwt.strategy';
import { UsersRepository } from './users.repository';

/**
 * AuthModule.forRoot({ users: PrismaUsersRepository, imports: [PrismaModule] })
 */
@Module({})
export class AuthModule {
  static forRoot(opts: { users: Type<UsersRepository>; imports?: any[]; expiresIn?: string }) {
    return {
      module: AuthModule,
      imports: [
        ...(opts.imports ?? []),
        PassportModule,
        JwtModule.registerAsync({
          useFactory: () => ({ secret: jwtSecret(), signOptions: { expiresIn: (opts.expiresIn ?? '7d') as any } }),
        }),
      ],
      providers: [AuthService, JwtStrategy, JwtAuthGuard, RolesGuard, { provide: UsersRepository, useClass: opts.users }],
      controllers: [AuthController],
      exports: [AuthService, JwtAuthGuard, RolesGuard],
    };
  }
}
