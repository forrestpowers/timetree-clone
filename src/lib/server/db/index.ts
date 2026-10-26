import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { drizzle } from 'drizzle-orm/node-sqlite';
import { migrate } from 'drizzle-orm/node-sqlite/migrator';
import { DATA_DIR } from '$app/env/private';
import * as schema from './schema';

mkdirSync(DATA_DIR, { recursive: true });

const client = new DatabaseSync(path.join(DATA_DIR, 'app.db'));
client.exec('PRAGMA journal_mode = WAL;');
client.exec('PRAGMA foreign_keys = ON;');
client.exec('PRAGMA busy_timeout = 5000;');

export const db = drizzle({ client });

migrate(db, { migrationsFolder: path.resolve('drizzle') });

export { schema };
