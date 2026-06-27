import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Public } from '../decorators/public.decorator';
import { AuthTokenResponseDto, MeResponseDto } from '../dtos/auth-response.dto';
import { LoginDto } from '../dtos/login.dto';
import { LogoutDto } from '../dtos/logout.dto';
import { RefreshTokenDto } from '../dtos/refresh-token.dto';
import type { AuthenticatedUser } from '../interfaces/authenticated-user.interface';
import { AuthService } from '../services/auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto): Promise<AuthTokenResponseDto> {
    return this.authService.login(dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshTokenDto): Promise<AuthTokenResponseDto> {
    return this.authService.refresh(dto.refresh_token);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Body() dto: LogoutDto): Promise<{ message: string }> {
    return this.authService.logout(dto.refresh_token);
  }

  @Get('me')
  getMe(@CurrentUser() user: AuthenticatedUser): Promise<MeResponseDto> {
    return this.authService.getMe(user.userId);
  }
}
