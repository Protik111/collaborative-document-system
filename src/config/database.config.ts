import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const getDatabaseConfig = (
  config: ConfigService,
): TypeOrmModuleOptions => ({
  type: 'postgres',
  url: config.get<string>('DATABASE_URL'),
  // Explicit entity paths (safer for production builds than globs)
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../migrations/*{.ts,.js}'],
  synchronize: config.get<string>('NODE_ENV') === 'development', // ⚠️ ONLY for dev
  logging: config.get<string>('NODE_ENV') === 'development',
  ssl:
    config.get<string>('NODE_ENV') === 'production'
      ? { rejectUnauthorized: false }
      : false,
  // Connection pool tuning
  extra: {
    max: 20,
    idleTimeoutMillis: 30000,
  },
});
