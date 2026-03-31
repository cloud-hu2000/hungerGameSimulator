import { EVENT_POOL_STATS } from '../../lib/events.js';

export default function handler() {
  return new Response(
    JSON.stringify({ success: true, data: EVENT_POOL_STATS }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    },
  );
}
