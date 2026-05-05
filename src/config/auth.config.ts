import { ConfigService } from '@nestjs/config';

export const getAuthConfig = (config: ConfigService) => ({
  jwt: {
    secret: config.get<string>('JWT_SECRET'),
    expiresIn: config.get<string>('JWT_EXPIRES_IN'),
  },
  refresh: {
    secret: config.get<string>('JWT_REFRESH_SECRET'),
    expiresIn: config.get<string>('JWT_REFRESH_EXPIRES_IN'),
  },
});
