import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../user/user.service';
import { LoginUserDto } from '../user/dto/login-user.dto';
import * as bcrypt from 'bcrypt';
import { JwtPayload, RefreshPayload } from './types/jwt-payload.type';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(loginDto: LoginUserDto) {
    // 1. Find user by email
    const user = await this.userService.findByEmailForAuth(loginDto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // 2. Verify password
    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password_hash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // 3. Generate tokens
    const jwtSecret = this.config.get<string>('JWT_SECRET');
    const jwtExpiresIn = this.config.get<string>('JWT_EXPIRES_IN');
    const jwtRefreshSecret = this.config.get<string>('JWT_REFRESH_SECRET');
    const jwtRefreshExpiresIn = this.config.get<string>(
      'JWT_REFRESH_EXPIRES_IN',
    );

    if (
      !jwtSecret ||
      !jwtExpiresIn ||
      !jwtRefreshSecret ||
      !jwtRefreshExpiresIn
    ) {
      throw new Error('Missing JWT configuration');
    }

    const accessToken = this.jwtService.sign(
      { email: user.email, sub: user.id } as JwtPayload,
      {
        secret: jwtSecret,
        expiresIn: jwtExpiresIn,
      } as JwtSignOptions,
    );

    const refreshToken = this.jwtService.sign(
      { email: user.email, sub: user.id } as JwtPayload,
      {
        secret: jwtRefreshSecret,
        expiresIn: jwtRefreshExpiresIn,
      } as JwtSignOptions,
    );

    // 4. Return tokens + safe user data (no password)
    const { password_hash, ...safeUser } = user;
    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: safeUser,
    };
  }

  async refreshTokens(refreshToken: string) {
    try {
      // 1. Verify refresh token signature + expiration
      const payload = this.jwtService.verify<RefreshPayload>(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });

      // 2. Fetch user by ID (minimal query, no password)
      const user = await this.userService.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // 3. Generate NEW access token (keep refresh token same for now)
      const newAccessToken = this.jwtService.sign<JwtPayload>(
        { sub: user.id, email: user.email },
        {
          secret: this.config.get<string>('JWT_SECRET'),
          expiresIn: this.config.get<string>('JWT_EXPIRES_IN'),
        } as JwtSignOptions,
      );

      return { access_token: newAccessToken };
    } catch (error) {
      // Distinguish error types for better client UX + security
      if (error instanceof Error && error.name === 'TokenExpiredError') {
        throw new UnauthorizedException(
          'Refresh token expired. Please login again.',
        );
      }
      if (error instanceof Error && error.name === 'JsonWebTokenError') {
        throw new UnauthorizedException('Invalid refresh token.');
      }
      // Fallback for any other error
      throw new UnauthorizedException('Failed to refresh token.');
    }
  }
}
