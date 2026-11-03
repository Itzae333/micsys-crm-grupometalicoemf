import { Body, Controller, Get, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { loginSchema } from '@micsys-crm/shared';
import type { LoginInput } from '@micsys-crm/shared';
import { AuthService } from './auth.service';
import { CurrentUser, Public, ZodPipe } from '../common/auth';
import type { AuthUser } from '../common/auth';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  login(@Body(new ZodPipe(loginSchema)) body: LoginInput) {
    return this.auth.login(body.email, body.password);
  }

  @Get('me')
  me(@CurrentUser() u: AuthUser) {
    return this.auth.me(u.id);
  }

  @Post('cerrar-sesiones')
  cerrar(@CurrentUser() u: AuthUser) {
    return this.auth.cerrarSesiones(u.id);
  }
}
