import { listSimulations, countSimulations } from '../lib/db.js';
export default async function handler(req) {
    const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    console.log(`[${requestId}] === Vercel API: listSimulations start ===`);
    const t0 = Date.now();
    if (req.method === 'OPTIONS') {
        console.log(`[${requestId}] Responding to OPTIONS`);
        return new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
            },
        });
    }
    const url = new URL(req.url);
    const limit = Math.min(parseInt(String(url.searchParams.get('limit') ?? '20')), 100);
    const offset = Math.max(parseInt(String(url.searchParams.get('offset') ?? '0')), 0);
    console.log(`[${requestId}] limit=${limit}, offset=${offset}`);
    try {
        console.log(`[${requestId}] Querying simulations from DB...`);
        const dbT0 = Date.now();
        const [simulations, total] = await Promise.all([
            listSimulations(limit, offset),
            countSimulations(),
        ]);
        console.log(`[${requestId}] DB query completed in ${Date.now() - dbT0}ms, found ${simulations.length} simulations, total=${total}`);
        const totalMs = Date.now() - t0;
        console.log(`[${requestId}] === Vercel API: listSimulations end, total ${totalMs}ms ===`);
        return new Response(JSON.stringify({ success: true, data: { simulations, total, limit, offset } }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
        });
    }
    catch (err) {
        console.error(`[${requestId}] Database error:`, err);
        return new Response(JSON.stringify({ success: false, error: 'Database error.' }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
        });
    }
}
