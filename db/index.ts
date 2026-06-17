import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from '@/db/schema';

const databaseUrl = process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/placeholder';
const globalForDrizzle = globalThis as unknown as {
  db: ReturnType<typeof drizzle<typeof schema>> | undefined;
};

export const db =
  globalForDrizzle.db ||
  drizzle(new Pool({ connectionString: databaseUrl }), {
    schema,
  });

if (process.env.NODE_ENV !== 'production') {
  globalForDrizzle.db = db;
}

export * from '@/db/schema';