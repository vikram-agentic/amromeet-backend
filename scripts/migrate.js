import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../config/database.js';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, '../migrations');

async function runMigrations() {
  const client = await pool.connect();

  try {
    console.log('🔄 Running database migrations...');

    // Read all migration files
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      console.log(`📝 Executing ${file}...`);
      await client.query(sql);
      console.log(`✅ ${file} completed`);
    }

    console.log('✨ All migrations completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.release();
    await pool.end();
  }
}

runMigrations();
