import { Body, Controller, Get, HttpCode, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CurrentUser, JwtAuthGuard } from './guards';
import type { JwtUser } from './jwt.strategy';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('register')
  register(@Body() b: { email: string; password: string; name: string }) {
    return this.auth.register(b?.email, b?.password, b?.name);
  }

  @Post('login')
  @HttpCode(200)
  login(@Body() b: { email: string; password: string }) {
    return this.auth.login(b?.email, b?.password);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() u: JwtUser) {
    return this.auth.me(u.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  updateProfile(@CurrentUser() u: JwtUser, @Body() b: { name?: string }) {
    return this.auth.updateProfile(u.userId, { name: b?.name });
  }

  @UseGuards(JwtAuthGuard)
  @Post('password')
  @HttpCode(200)
  changePassword(@CurrentUser() u: JwtUser, @Body() b: { current: string; next: string }) {
    return this.auth.changePassword(u.userId, b?.current, b?.next);
  }
}
