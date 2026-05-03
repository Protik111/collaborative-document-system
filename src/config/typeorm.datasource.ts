// src/config/typeorm.datasource.ts
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

// 1. Load .env explicitly for CLI usage
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

// 2. Validate required env vars (fail fast)
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not defined in .env');
}

// 3. Create DataSource using process.env directly
export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [path.join(__dirname, '../**/*.entity{.ts,.js}')],
  migrations: [path.join(__dirname, '../migrations/*{.ts,.js}')],
  synchronize: false, // Never true when using migrations
  logging: process.env.NODE_ENV === 'development',
  ssl:
    process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false,
  extra: {
    max: 20,
    idleTimeoutMillis: 30000,
  },
});
