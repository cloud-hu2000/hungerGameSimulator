import { runSimulation } from './lib/simulator.js';
export default async function handler(req) {
    const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    console.log(`[${requestId}] === Vercel API: simulate handler start ===`);
    console.log(`[${requestId}] Method: ${req.method}, URL: ${req.url}`);
    const t0 = Date.now();
    if (req.method === 'OPTIONS') {
        console.log(`[${requestId}] Responding to OPTIONS`);
        return new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Credentials': 'true',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
            },
        });
    }
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ success: false, error: 'Method not allowed.' }), {
            status: 405,
            headers: {
                'Content-Type': 'application/json',
                'Allow': 'POST',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Credentials': 'true',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
            },
        });
    }
    let body;
    try {
        console.log(`[${requestId}] Parsing request body...`);
        const bodyT0 = Date.now();
        body = await req.json();
        console.log(`[${requestId}] Body parsed in ${Date.now() - bodyT0}ms, tributes count: ${body?.tributes?.length ?? 0}`);
    }
    catch {
        return new Response(JSON.stringify({ success: false, error: 'Invalid JSON body.' }), {
            status: 400,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Credentials': 'true',
            },
        });
    }
    if (!body.tributes || !Array.isArray(body.tributes) || body.tributes.length < 2) {
        console.log(`[${requestId}] Validation failed: tributes count ${body.tributes?.length ?? 0}`);
        return new Response(JSON.stringify({ success: false, error: 'At least 2 tributes are required.' }), {
            status: 400,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Credentials': 'true',
            },
        });
    }
    if (body.tributes.length > 48) {
        return new Response(JSON.stringify({ success: false, error: 'Maximum 48 tributes allowed.' }), {
            status: 400,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Credentials': 'true',
            },
        });
    }
    for (let i = 0; i < body.tributes.length; i++) {
        if (!body.tributes[i].name?.trim()) {
            return new Response(JSON.stringify({ success: false, error: `Tribute ${i + 1} is missing a name.` }), {
                status: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Credentials': 'true',
                },
            });
        }
    }
    const settings = {
        deathsPerRound: body.settings?.deathsPerRound ?? 1,
        startOnDay: body.settings?.startOnDay ?? 0,
        maxRounds: Math.min(body.settings?.maxRounds ?? 30, 30),
        feastEnabled: body.settings?.feastEnabled ?? true,
    };
    try {
        console.log(`[${requestId}] Starting simulation...`);
        const simT0 = Date.now();
        const result = runSimulation({ ...body, settings });
        console.log(`[${requestId}] Simulation completed in ${Date.now() - simT0}ms, totalRounds: ${result.totalRounds}, totalDeaths: ${result.metadata.totalDeaths}`);
        // ── Immediately return response ────────────────────────────
        // The simulation result is ready — send it back to the client
        // without waiting for database writes.
        const responseBody = JSON.stringify({ success: true, data: result });
        // ── Persist to Neon in the background ─────────────────────
        // Skip DB entirely in Vercel to avoid any async blocking.
        // Vercel waits for all pending Promises before terminating the
        // function, so a fire-and-forget still causes timeout.
        console.log(`[${requestId}] VERCEL=${process.env.VERCEL}, starting background persist...`);
        const dbT0 = Date.now();
        if (process.env.VERCEL !== '1') {
            persistAsync(result).then(() => {
                console.log(`[${requestId}] Background persist completed in ${Date.now() - dbT0}ms`);
            }).catch(err => {
                console.error(`[${requestId}] background persist failed:`, err);
            });
        }
        else {
            console.log(`[${requestId}] Running on Vercel, skipping DB persistence`);
        }
        const totalMs = Date.now() - t0;
        console.log(`[${requestId}] === Vercel API: simulate handler end, total ${totalMs}ms ===`);
        return new Response(responseBody, {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Credentials': 'true',
            },
        });
    }
    catch (err) {
        console.error('[simulate]', err);
        return new Response(JSON.stringify({ success: false, error: 'Simulation failed. Please try again.' }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Credentials': 'true',
            },
        });
    }
}
// ─────────────────────────────────────────────────────────────
// Background persistence helpers
// ─────────────────────────────────────────────────────────────
async function persistAsync(result) {
    const { saveSimulation, saveTributes, saveEvents } = await import('./lib/db.js');
    const [, tributesOk, eventsOk] = await Promise.allSettled([
        saveSimulation({
            id: result.id,
            startedAt: result.metadata.startedAt,
            finishedAt: result.metadata.finishedAt,
            totalRounds: result.totalRounds,
            totalDeaths: result.metadata.totalDeaths,
            winnerId: result.winner?.id,
            winnerName: result.winner?.name,
        }),
        saveTributes(result.tributeStats.map(t => ({
            id: t.id,
            simulationId: result.id,
            name: t.name,
            pronouns: t.pronouns,
            imageUrl: t.imageUrl,
            district: t.district,
            skills: t.skills,
            alive: t.alive,
            deathRound: t.deathRound,
            deathCause: t.deathCause === 'alive' ? undefined : t.deathCause,
            kills: t.kills,
        }))),
        saveEvents(result.allRounds.flatMap(round => [
            ...(round.bloodbathPhase ?? []),
            ...round.dayPhase,
            ...round.nightPhase,
            ...(round.feastPhase ?? []),
        ]).map((e, idx) => ({
            id: `${result.id}-e${idx}`,
            simulationId: result.id,
            round: e.round,
            stage: e.stage,
            message: e.message,
            isFatal: e.isFatal,
            deaths: e.deaths,
            killers: e.killers,
            tags: e.tags,
            cause: e.cause,
        }))),
    ]);
    if (tributesOk?.status === 'rejected') {
        console.error('[simulate] saveTributes failed:', tributesOk.reason);
    }
    if (eventsOk?.status === 'rejected') {
        console.error('[simulate] saveEvents failed:', eventsOk.reason);
    }
}
