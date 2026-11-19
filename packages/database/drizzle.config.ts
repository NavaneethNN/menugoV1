import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const targetDbUrl =
  process.env.QROS_DATABASE_URL ||
  process.env.DATABASE_URL ||
  process.env.RESTAURANT_DATABASE_URL;

if (!targetDbUrl) {
  throw new Error('DATABASE_URL or QROS_DATABASE_URL environment variable is missing.');
}

export default defineConfig({
  schema: './src/schema.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: targetDbUrl
  },
  verbose: true,
  strict: false
});
