import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { jwtSecret } from './jwt-secret';

export type JwtUser = { userId: string; email: string; role: string };

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({ jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), ignoreExpiration: false, secretOrKey: jwtSecret() });
  }
  validate(payload: { sub: string; email: string; role: string }): JwtUser {
    return { userId: payload.sub, email: payload.email, role: payload.role };
  }
}
