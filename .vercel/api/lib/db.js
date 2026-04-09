import { neon } from '@neondatabase/serverless';
// ─────────────────────────────────────────────────────────────
// Neon client — reads DATABASE_URL from environment.
// ─────────────────────────────────────────────────────────────
const DATABASE_URL = process.env.DATABASE_URL;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _neonFn = DATABASE_URL ? neon(DATABASE_URL) : null;
const sql = _neonFn;
let schemaInitialized = false;
function logDb(label, startTime, ...args) {
    const ms = Date.now() - startTime;
    console.log(`[DB] ${label} completed in ${ms}ms`, ...args);
}
// Batch INSERT helper — accumulates rows and flushes in chunks.
// This collapses N individual network round-trips into ceil(N / chunkSize) calls.
async function batchInsert(tableName, rows, columns, chunkSize = 100) {
    if (!sql || rows.length === 0)
        return;
    for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const colList = columns.join(', ');
        // Build one VALUES (...) clause per row; each row's placeholders are ($1,$2,...)
        const valueClauses = chunk.map((row, rowIdx) => {
            const offset = rowIdx * columns.length;
            const placeholders = columns
                .map((_, colIdx) => `$${offset + colIdx + 1}`)
                .join(', ');
            return `(${placeholders})`;
        }).join(', ');
        const flatValues = [];
        for (const row of chunk) {
            for (const col of columns) {
                flatValues.push(row[col] ?? null);
            }
        }
        await sql.unsafe(`INSERT INTO ${tableName} (${colList}) VALUES ${valueClauses}`);
    }
}
// ─────────────────────────────────────────────────────────────
// Schema init — runs once per cold start (lazy, first DB call)
// ─────────────────────────────────────────────────────────────
async function ensureSchema() {
    const t0 = Date.now();
    if (!sql || schemaInitialized)
        return;
    schemaInitialized = true;
    console.log('[DB] Creating schema...');
    await sql `
    CREATE TABLE IF NOT EXISTS simulations (
      id            TEXT PRIMARY KEY,
      started_at    TEXT NOT NULL,
      finished_at   TEXT NOT NULL,
      total_rounds  INTEGER NOT NULL DEFAULT 0,
      total_deaths  INTEGER NOT NULL DEFAULT 0,
      winner_id     TEXT,
      winner_name   TEXT,
      created_at    TEXT NOT NULL DEFAULT (now()::text)
    );
  `;
    await sql `
    CREATE TABLE IF NOT EXISTS simulation_tributes (
      id             TEXT NOT NULL,
      simulation_id  TEXT NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
      name           TEXT NOT NULL,
      pronouns       TEXT NOT NULL DEFAULT 'they/them',
      image_url      TEXT,
      district       TEXT,
      skills         TEXT NOT NULL DEFAULT '[]',
      alive          INTEGER NOT NULL DEFAULT 1,
      death_round    INTEGER,
      death_cause    TEXT,
      kills          INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (simulation_id, id)
    );
  `;
    await sql `
    CREATE TABLE IF NOT EXISTS simulation_events (
      id             TEXT NOT NULL,
      simulation_id  TEXT NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
      round          INTEGER NOT NULL,
      stage          TEXT NOT NULL,
      message        TEXT NOT NULL,
      is_fatal       INTEGER NOT NULL DEFAULT 0,
      deaths         TEXT NOT NULL DEFAULT '[]',
      killers        TEXT NOT NULL DEFAULT '[]',
      tags           TEXT NOT NULL DEFAULT '[]',
      cause          TEXT NOT NULL DEFAULT 'killed',
      PRIMARY KEY (simulation_id, id)
    );
  `;
    await sql `CREATE INDEX IF NOT EXISTS idx_tributes_sim ON simulation_tributes(simulation_id);`;
    await sql `CREATE INDEX IF NOT EXISTS idx_events_sim   ON simulation_events(simulation_id);`;
    await sql `CREATE INDEX IF NOT EXISTS idx_events_round ON simulation_events(simulation_id, round);`;
    console.log('[DB] Schema created');
    logDb('ensureSchema', t0);
}
export async function saveSimulation(sim) {
    const t0 = Date.now();
    if (!sql)
        return;
    await ensureSchema();
    await sql `
    INSERT INTO simulations (id, started_at, finished_at, total_rounds, total_deaths, winner_id, winner_name)
    VALUES (
      ${sim.id},
      ${sim.startedAt},
      ${sim.finishedAt},
      ${sim.totalRounds},
      ${sim.totalDeaths},
      ${sim.winnerId ?? null},
      ${sim.winnerName ?? null}
    )
  `;
    logDb('saveSimulation', t0, `id=${sim.id}`);
}
export async function getSimulation(id) {
    const t0 = Date.now();
    if (!sql)
        return null;
    await ensureSchema();
    const rows = await sql `SELECT * FROM simulations WHERE id = ${id}`;
    logDb('getSimulation', t0, `id=${id}, found=${rows.length > 0}`);
    return rows[0] ?? null;
}
export async function listSimulations(limit = 20, offset = 0) {
    const t0 = Date.now();
    if (!sql)
        return [];
    await ensureSchema();
    const result = await sql `
    SELECT * FROM simulations
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
    logDb('listSimulations', t0, `limit=${limit}, offset=${offset}, count=${result.length}`);
    return result;
}
export async function countSimulations() {
    const t0 = Date.now();
    if (!sql)
        return 0;
    await ensureSchema();
    const [row] = await sql `SELECT COUNT(*) as cnt FROM simulations`;
    logDb('countSimulations', t0);
    return row?.cnt ?? 0;
}
export async function deleteSimulation(id) {
    const t0 = Date.now();
    if (!sql)
        return;
    await ensureSchema();
    await sql `DELETE FROM simulations WHERE id = ${id}`;
    logDb('deleteSimulation', t0, `id=${id}`);
}
export async function saveTributes(tributes) {
    const t0 = Date.now();
    if (!sql || tributes.length === 0)
        return;
    await ensureSchema();
    await batchInsert('simulation_tributes', tributes.map(t => ({
        id: t.id,
        simulation_id: t.simulationId,
        name: t.name,
        pronouns: t.pronouns,
        image_url: t.imageUrl ?? null,
        district: t.district ?? null,
        skills: JSON.stringify(t.skills),
        alive: t.alive ? 1 : 0,
        death_round: t.deathRound ?? null,
        death_cause: t.deathCause ?? null,
        kills: t.kills,
    })), ['id', 'simulation_id', 'name', 'pronouns', 'image_url', 'district', 'skills', 'alive', 'death_round', 'death_cause', 'kills']);
    logDb('saveTributes', t0, `count=${tributes.length}`);
}
export async function getTributesForSimulation(simId) {
    const t0 = Date.now();
    if (!sql)
        return [];
    await ensureSchema();
    const rows = await sql `
    SELECT * FROM simulation_tributes WHERE simulation_id = ${simId} ORDER BY name
  `;
    const result = rows.map((r) => ({
        id: r.id,
        simulationId: r.simulation_id,
        name: r.name,
        pronouns: r.pronouns,
        imageUrl: r.image_url ?? undefined,
        district: r.district ?? undefined,
        skills: JSON.parse(r.skills),
        alive: Boolean(r.alive),
        deathRound: r.death_round ?? undefined,
        deathCause: r.death_cause ?? undefined,
        kills: r.kills,
    }));
    logDb('getTributesForSimulation', t0, `simId=${simId}, count=${result.length}`);
    return result;
}
export async function saveEvents(events) {
    const t0 = Date.now();
    if (!sql || events.length === 0)
        return;
    await ensureSchema();
    await batchInsert('simulation_events', events.map(e => ({
        id: e.id,
        simulation_id: e.simulationId,
        round: e.round,
        stage: e.stage,
        message: e.message,
        is_fatal: e.isFatal ? 1 : 0,
        deaths: JSON.stringify(e.deaths),
        killers: JSON.stringify(e.killers),
        tags: JSON.stringify(e.tags),
        cause: e.cause,
    })), ['id', 'simulation_id', 'round', 'stage', 'message', 'is_fatal', 'deaths', 'killers', 'tags', 'cause']);
    logDb('saveEvents', t0, `count=${events.length}`);
}
export async function getEventsForSimulation(simId) {
    const t0 = Date.now();
    if (!sql)
        return [];
    await ensureSchema();
    const rows = await sql `
    SELECT * FROM simulation_events WHERE simulation_id = ${simId} ORDER BY round, stage
  `;
    const result = rows.map((r) => ({
        id: r.id,
        simulationId: r.simulation_id,
        round: r.round,
        stage: r.stage,
        message: r.message,
        isFatal: Boolean(r.is_fatal),
        deaths: JSON.parse(r.deaths),
        killers: JSON.parse(r.killers),
        tags: JSON.parse(r.tags),
        cause: r.cause,
    }));
    logDb('getEventsForSimulation', t0, `simId=${simId}, count=${result.length}`);
    return result;
}
export async function getFullSimulation(id) {
    const t0 = Date.now();
    const sim = await getSimulation(id);
    if (!sim)
        return null;
    const [tributes, events] = await Promise.all([
        getTributesForSimulation(id),
        getEventsForSimulation(id),
    ]);
    logDb('getFullSimulation', t0, `simId=${id}, tributes=${tributes.length}, events=${events.length}`);
    return { simulation: sim, tributes, events };
}
