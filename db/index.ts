import { Pool, neonConfig } from '@neondatabase/serverless';
import * as schema from '@shared/schema';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';

// This is the correct way neon config - DO NOT change this
neonConfig.webSocketConstructor = ws;

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle({ client: pool, schema });
