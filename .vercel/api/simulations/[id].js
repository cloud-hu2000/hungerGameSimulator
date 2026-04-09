import { getFullSimulation, deleteSimulation } from '../lib/db.js';
export default async function handler(req, { params }) {
    const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    console.log(`[${requestId}] === Vercel API: simulations/[id] start ===`);
    console.log(`[${requestId}] Method: ${req.method}, params.id: ${params?.id}`);
    const t0 = Date.now();
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const id = pathParts[pathParts.length - 1];
    console.log(`[${requestId}] Parsed ID from path: ${id}`);
    if (req.method === 'OPTIONS') {
        console.log(`[${requestId}] Responding to OPTIONS`);
        return new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
            },
        });
    }
    if (req.method === 'GET') {
        try {
            console.log(`[${requestId}] Fetching simulation from DB...`);
            const dbT0 = Date.now();
            const full = await getFullSimulation(id);
            console.log(`[${requestId}] DB query completed in ${Date.now() - dbT0}ms, found: ${!!full}`);
            if (!full) {
                console.log(`[${requestId}] Simulation not found, returning 404`);
                return new Response(JSON.stringify({ success: false, error: 'Not found.' }), {
                    status: 404,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                });
            }
            return new Response(JSON.stringify({ success: true, data: full }), {
                status: 200,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            });
        }
        catch (err) {
            console.error(`[${requestId}] getFullSimulation error:`, err);
            return new Response(JSON.stringify({ success: false, error: 'Database error.' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            });
        }
    }
    if (req.method === 'DELETE') {
        try {
            console.log(`[${requestId}] Checking if simulation exists...`);
            const full = await getFullSimulation(id);
            if (!full) {
                console.log(`[${requestId}] Simulation not found for delete, returning 404`);
                return new Response(JSON.stringify({ success: false, error: 'Not found.' }), {
                    status: 404,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                });
            }
            console.log(`[${requestId}] Simulation found, deleting...`);
            const dbT0 = Date.now();
            await deleteSimulation(id);
            console.log(`[${requestId}] Delete completed in ${Date.now() - dbT0}ms`);
            const totalMs = Date.now() - t0;
            console.log(`[${requestId}] === Vercel API: simulations/[id] DELETE end, total ${totalMs}ms ===`);
            return new Response(JSON.stringify({ success: true, data: { id } }), {
                status: 200,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            });
        }
        catch (err) {
            console.error(`[${requestId}] deleteSimulation error:`, err);
            return new Response(JSON.stringify({ success: false, error: 'Database error.' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            });
        }
    }
    return new Response(JSON.stringify({ success: false, error: 'Method not allowed.' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json', 'Allow': 'GET, DELETE', 'Access-Control-Allow-Origin': '*' },
    });
}
