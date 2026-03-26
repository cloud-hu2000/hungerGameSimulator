# Arena — Hunger Games Simulator

A modern, Node.js-powered Hunger Games simulator with a curated event pool and relationship-weighted simulation engine.

**Live at:** http://localhost:5173 (client) · http://localhost:3001 (API)

## Tech Stack

- **Server:** Node.js + Express + TypeScript (tsx for dev)
- **Database:** [Neon](https://neon.tech) PostgreSQL via `@neondatabase/serverless`
- **Client:** React 19 + TypeScript + Vite
- **Styling:** Pure CSS (CSS variables, no framework)
- **Monorepo:** npm workspaces

## Getting Started

```bash
# Install dependencies (once)
npm install

# Start both server and client in dev mode
npm run dev
```

- API: http://localhost:3001
- Client: http://localhost:5173

## What's Built

### 110+ Curated Events
Drawn from BrantSteele and nguh.org, organized across 5 stages:
- **Bloodbath** (30 events) — Cornucopia chaos
- **Day** (50 events) — Arena action, hunts, sponsor gifts
- **Night** (30 events) — Campfire alliances, ambushes, survival
- **Feast** (15 events) — High-stakes supply runs
- **All-stage** (40 events) — Universal events (any phase)

### Relationship System
- Ally / Enemy / Neutral relations between tributes
- **Weight boosting:** ally-related events fire more often when alliances exist; enemy events fire more when rivalries exist; betrayal events double-weight when an alliance is present
- Interactive relationship editor in the UI

### Persistence (Neon PostgreSQL)
- Uses `@neondatabase/serverless` — reads `DATABASE_URL` from environment
- Schema auto-created on startup (`CREATE TABLE IF NOT EXISTS`)
- All simulations survive server restarts
- Gracefully degrades if `DATABASE_URL` is not set (writes are skipped, reads return empty)
- Copy `.env.example` → `.env` and fill in your Neon connection string
- New endpoints: list, load, delete past simulations

### Simulation Engine
- Deterministic pronoun resolution (`%N`, `%A`, `%G`, `%R`, `%i`, `%h`, etc.)
- Weighted random event selection with rarity tiers (common 60% / rare 30% / epic 10%)
- Bloodbath → Day → Night → (Feast every 5 rounds) loop
- Tracks kills, death causes, death rounds per tribute

## Project Structure

```
hunterGameSimulator/
├── server/
│   ├── .env.example        ← copy to .env and add Neon DATABASE_URL
│   └── src/
│       ├── types.ts       # Shared TypeScript types
│       ├── events.ts      # 110+ event definitions
│       ├── simulator.ts   # Simulation engine
│       ├── db.ts          # Neon persistence layer
│       └── index.ts      # Express API server
└── client/
    └── src/
        ├── App.tsx        # Main React app
        └── index.css     # Global styles
```

## API

### `POST /api/simulate`
Same as above. Result is also persisted to Neon (if `DATABASE_URL` is set).

### `GET /api/simulations`
Returns paginated list of all saved simulations.

```json
{ "success": true, "data": { "simulations": [...], "total": 42, "limit": 20, "offset": 0 } }
```

### `GET /api/simulations/:id`
Returns full simulation (metadata + tributes + events) from the database.

### `DELETE /api/simulations/:id`
Deletes a simulation and all its tributes/events from the database.

```json
{
  "tributes": [
    { "id": "1", "name": "Katniss", "pronouns": "she/her", "skills": ["archery"] }
  ],
  "relationships": [
    { "from": "1", "to": "2", "type": "ally", "strength": 3 }
  ],
  "settings": {
    "deathsPerRound": 0,
    "startOnDay": 0,
    "maxRounds": 50,
    "feastEnabled": true
  }
}
```

### `GET /api/events/stats`
Returns event pool statistics.
