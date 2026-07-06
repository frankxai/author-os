import {
  createPostgresBillingAdapter,
  createPostgresProjectAdapter,
} from '@author-os/cloud';

let pgPool = null;
let poolAttached = false;

function getConnectionString(env = process.env) {
  return env.POSTGRES_URL || env.DATABASE_URL || env.POSTGRES_PRISMA_URL || null;
}

function createDatabaseConfig(env = process.env) {
  const connectionString = getConnectionString(env);
  if (!connectionString) {
    const error = new Error('A Marketplace Postgres connection string is required. Set POSTGRES_URL or DATABASE_URL.');
    error.code = 'POSTGRES_URL_REQUIRED';
    error.status = 503;
    throw error;
  }

  return {
    connectionString,
    max: Number(env.AUTHOROS_PG_POOL_MAX || 5),
    idleTimeoutMillis: Number(env.AUTHOROS_PG_IDLE_TIMEOUT_MS || 5000),
    connectionTimeoutMillis: Number(env.AUTHOROS_PG_CONNECTION_TIMEOUT_MS || 5000),
  };
}

async function getPool(env = process.env) {
  if (pgPool) return pgPool;

  const [pgModule, vercelFunctions] = await Promise.all([
    import('pg'),
    import('@vercel/functions').catch(() => ({})),
  ]);
  const Pool = pgModule.Pool || pgModule.default?.Pool;
  if (typeof Pool !== 'function') {
    throw new Error('pg Pool constructor was not available from the pg package.');
  }

  pgPool = new Pool(createDatabaseConfig(env));
  const attachDatabasePool = vercelFunctions.attachDatabasePool || vercelFunctions.default?.attachDatabasePool;
  if (!poolAttached && typeof attachDatabasePool === 'function') {
    attachDatabasePool(pgPool);
    poolAttached = true;
  }
  return pgPool;
}

export function getPostgresRuntimeInfo(env = process.env) {
  return {
    provider: 'vercel-marketplace-postgres',
    driver: 'pg',
    poolMax: Number(env.AUTHOROS_PG_POOL_MAX || 5),
    idleTimeoutMs: Number(env.AUTHOROS_PG_IDLE_TIMEOUT_MS || 5000),
    hasConnectionString: Boolean(getConnectionString(env)),
  };
}

export function createVercelMarketplacePostgresProjectAdapter({ env = process.env } = {}) {
  const query = async (sql, params = []) => {
    const pool = await getPool(env);
    return pool.query(sql, params);
  };

  const withWorkspaceScope = async (workspaceId, operation) => {
    if (!workspaceId) {
      const error = new Error('Workspace scope is required for hosted Postgres operations.');
      error.code = 'WORKSPACE_SCOPE_REQUIRED';
      error.status = 500;
      throw error;
    }

    const pool = await getPool(env);
    const client = await pool.connect();
    const scopedQuery = (sql, params = []) => client.query(sql, params);

    try {
      await client.query('begin');
      await client.query("select set_config('app.current_workspace_id', $1, true)", [workspaceId]);
      const result = await operation(scopedQuery);
      await client.query('commit');
      return result;
    } catch (error) {
      await client.query('rollback').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  };

  return createPostgresProjectAdapter({ query, withWorkspaceScope });
}

export function createVercelMarketplacePostgresBillingAdapter({ env = process.env } = {}) {
  const query = async (sql, params = []) => {
    const pool = await getPool(env);
    return pool.query(sql, params);
  };

  const withWorkspaceScope = async (workspaceId, operation) => {
    const pool = await getPool(env);
    const client = await pool.connect();
    const scopedQuery = (sql, params = []) => client.query(sql, params);

    try {
      await client.query('begin');
      if (workspaceId) {
        await client.query("select set_config('app.current_workspace_id', $1, true)", [workspaceId]);
      }
      const result = await operation(scopedQuery);
      await client.query('commit');
      return result;
    } catch (error) {
      await client.query('rollback').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  };

  return createPostgresBillingAdapter({ query, withWorkspaceScope });
}
