/**
 * DB Migration runner — executes schema.sql against the configured Postgres DB.
 * Usage: npm run db:migrate
 */
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { query, closePool } from './DatabaseClient';
import { logger } from '../utils/Logger';

dotenv.config();

async function migrate(): Promise<void> {
  const schemaPath = path.resolve(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf-8');

  logger.info('Running DB migration...');
  await query(sql);
  logger.info('Migration complete ✓');
  await closePool();
}

// Guard: only run when invoked directly (not when imported by gauge-ts)
if (require.main === module) {
  migrate().catch((err) => {
    logger.error('Migration failed', { error: (err as Error).message });
    process.exit(1);
  });
}
