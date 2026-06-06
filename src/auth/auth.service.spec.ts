import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let userService: UserService;
  let jwtService: JwtService;
  let configService: ConfigService;

  const mockUser = {
    id: 'user-id',
    email: 'test@example.com',
    password_hash: 'hashed-password',
    name: 'Test User',
  };

  const mockUserService = {
    findByEmailForAuth: jest.fn(),
    findById: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string): string | null => {
      const config: Record<string, string> = {
        JWT_SECRET: 'test-secret',
        JWT_EXPIRES_IN: '15m',
        JWT_REFRESH_SECRET: 'test-refresh-secret',
        JWT_REFRESH_EXPIRES_IN: '7d',
      };
      return config[key] || null;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserService, useValue: mockUserService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userService = module.get<UserService>(UserService);
    jwtService = module.get<JwtService>(JwtService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    const loginDto = { email: 'test@example.com', password: 'password' };

    it('should return tokens and safe user data for valid credentials', async () => {
      mockUserService.findByEmailForAuth.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwtService.sign.mockReturnValueOnce('access-token').mockReturnValueOnce('refresh-token');

      const result = await service.login(loginDto);

      expect(result).toEqual({
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        user: {
          id: mockUser.id,
          email: mockUser.email,
          name: mockUser.name,
        },
      });
      expect(userService.findByEmailForAuth).toHaveBeenCalledWith(loginDto.email);
      expect(bcrypt.compare).toHaveBeenCalledWith(loginDto.password, mockUser.password_hash);
    });

    it('should throw UnauthorizedException if user is not found', async () => {
      mockUserService.findByEmailForAuth.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for invalid password', async () => {
      mockUserService.findByEmailForAuth.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw Error if JWT config is missing', async () => {
      mockUserService.findByEmailForAuth.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockConfigService.get.mockReturnValue(null);

      await expect(service.login(loginDto)).rejects.toThrow('Missing JWT configuration');
    });
  });

  describe('refreshTokens', () => {
    const refreshToken = 'valid-refresh-token';

    it('should return a new access token for a valid refresh token', async () => {
      const payload = { sub: 'user-id', email: 'test@example.com' };
      mockJwtService.verify.mockReturnValue(payload);
      mockUserService.findById.mockResolvedValue(mockUser);
      mockJwtService.sign.mockReturnValue('new-access-token');

      const result = await service.refreshTokens(refreshToken);

      expect(result).toEqual({ access_token: 'new-access-token' });
      expect(jwtService.verify).toHaveBeenCalledWith(refreshToken, expect.any(Object));
      expect(userService.findById).toHaveBeenCalledWith(payload.sub);
    });

    it('should throw UnauthorizedException if user in payload is not found', async () => {
      mockJwtService.verify.mockReturnValue({ sub: 'non-existent' });
      mockUserService.findById.mockResolvedValue(null);

      await expect(service.refreshTokens(refreshToken)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for expired refresh token', async () => {
      const error = new Error('Expired');
      error.name = 'TokenExpiredError';
      mockJwtService.verify.mockImplementation(() => {
        throw error;
      });

      await expect(service.refreshTokens(refreshToken)).rejects.toThrow('Refresh token expired');
    });

    it('should throw UnauthorizedException for invalid refresh token', async () => {
      const error = new Error('Invalid');
      error.name = 'JsonWebTokenError';
      mockJwtService.verify.mockImplementation(() => {
        throw error;
      });

      await expect(service.refreshTokens(refreshToken)).rejects.toThrow('Invalid refresh token.');
    });
  });
});
