import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const AUTHOR_OS_CLOUD_MIGRATION_VERSION = '001_author_os_cloud';

const CLOUD_PACKAGE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_MIGRATIONS_DIR = path.join(CLOUD_PACKAGE_DIR, 'migrations');
const CLOUD_MIGRATION_MANIFEST = [
  {
    version: AUTHOR_OS_CLOUD_MIGRATION_VERSION,
    filename: '001_author_os_cloud.sql',
    description: 'Initial AuthorOS hosted cloud schema, RLS policies, audit records, and production ledger tables.',
  },
];

function normalizeRows(result) {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.rows)) return result.rows;
  return [];
}

function checksumSql(sql) {
  return createHash('sha256').update(sql, 'utf8').digest('hex');
}

export function loadCloudMigrations(input = {}) {
  const migrationsDir = input.migrationsDir || DEFAULT_MIGRATIONS_DIR;
  return CLOUD_MIGRATION_MANIFEST.map(item => {
    const filePath = path.join(migrationsDir, item.filename);
    const sql = fs.readFileSync(filePath, 'utf8');
    return {
      ...item,
      filePath,
      sql,
      checksum: checksumSql(sql),
    };
  });
}

export function createCloudMigrationPlan(input = {}) {
  const migrations = input.migrations || loadCloudMigrations(input);
  const appliedMigrations = input.appliedMigrations || input.applied || [];
  const appliedByVersion = new Map(appliedMigrations.map(item => [item.version, item]));
  const applied = [];
  const pending = [];
  const checksumMismatches = [];

  for (const migration of migrations) {
    const existing = appliedByVersion.get(migration.version);
    if (!existing) {
      pending.push(migration);
      continue;
    }
    applied.push({ ...migration, appliedAt: existing.applied_at || existing.appliedAt || null });
    if (existing.checksum && existing.checksum !== migration.checksum) {
      checksumMismatches.push({
        version: migration.version,
        expected: migration.checksum,
        actual: existing.checksum,
      });
    }
  }

  return {
    status: checksumMismatches.length ? 'checksum_mismatch' : pending.length ? 'pending' : 'current',
    latestVersion: migrations.at(-1)?.version || null,
    migrationCount: migrations.length,
    applied,
    pending,
    checksumMismatches,
  };
}

export function createCloudMigrationRunner(input = {}) {
  const query = input.query;
  const now = input.now || (() => new Date().toISOString());
  const appliedBy = input.appliedBy || 'author-os-cli';
  if (typeof query !== 'function') throw new Error('createCloudMigrationRunner requires a query(sql, params) function.');

  async function ensureMigrationLedger() {
    await query([
      'create table if not exists author_schema_migrations (',
      'version text primary key,',
      'checksum text not null,',
      'description text,',
      'applied_by text not null,',
      'applied_at timestamptz not null default now()',
      ')',
    ].join(' '));
  }

  async function readAppliedMigrations() {
    await ensureMigrationLedger();
    const result = await query('select version, checksum, description, applied_by, applied_at from author_schema_migrations order by version');
    return normalizeRows(result);
  }

  async function applyMigration(migration) {
    await query('begin');
    try {
      await query(migration.sql);
      await query(
        [
          'insert into author_schema_migrations (version, checksum, description, applied_by, applied_at)',
          'values ($1, $2, $3, $4, $5)',
          'on conflict (version) do update set',
          'checksum = excluded.checksum,',
          'description = excluded.description,',
          'applied_by = excluded.applied_by,',
          'applied_at = excluded.applied_at',
        ].join(' '),
        [migration.version, migration.checksum, migration.description || '', appliedBy, now()],
      );
      await query('commit');
      return { version: migration.version, checksum: migration.checksum, status: 'applied' };
    } catch (error) {
      await query('rollback').catch(() => {});
      throw error;
    }
  }

  return {
    ensureMigrationLedger,
    readAppliedMigrations,
    async plan(options = {}) {
      const migrations = options.migrations || loadCloudMigrations(options);
      const appliedMigrations = await readAppliedMigrations();
      return createCloudMigrationPlan({ migrations, appliedMigrations });
    },
    async applyPendingMigrations(options = {}) {
      const migrations = options.migrations || loadCloudMigrations(options);
      const appliedMigrations = await readAppliedMigrations();
      const plan = createCloudMigrationPlan({ migrations, appliedMigrations });
      if (plan.checksumMismatches.length) {
        const error = new Error(`Cloud migration checksum mismatch for ${plan.checksumMismatches.map(item => item.version).join(', ')}.`);
        error.code = 'MIGRATION_CHECKSUM_MISMATCH';
        error.status = 409;
        error.plan = plan;
        throw error;
      }
      if (options.dryRun) {
        return {
          dryRun: true,
          plan,
          applied: [],
        };
      }
      const applied = [];
      for (const migration of plan.pending) {
        applied.push(await applyMigration(migration));
      }
      const finalPlan = createCloudMigrationPlan({
        migrations,
        appliedMigrations: [...appliedMigrations, ...applied],
      });
      return {
        dryRun: false,
        plan,
        applied,
        finalPlan,
      };
    },
  };
}
