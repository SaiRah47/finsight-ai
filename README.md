# FinSight ATLAS

An experimental, non-commercial financial intelligence workspace for a single user.

## Current foundation

- Custom **Next.js + TypeScript** Spectrum dashboard with responsive layout
- **LangGraph** routing graph for market, risk, and SEC filing research intents
- Server-Sent Events demonstration at `POST /api/agent/trace`
- **Execution Studio** tab that displays emitted workflow events
- **GitHub Actions** production build checks
- Mock financial values are explicitly labeled synthetic; live data is not connected

## Run

```bash
npm install
npm run dev
```

Visit http://localhost:3000. The health endpoint is `GET /api/health`.

## Quality checks

```bash
npm run typecheck
npm run build
```

## Next

Supabase access control, real market data providers, richer workflow traces, and Vercel deployment.

## Data and privacy

Do not commit credentials, brokerage data, personal holdings, private planning documents, or interview notes. All financial prices and valuations currently shown are **fictional samples**, not live recommendations.

## Development status

This is the **GitHub-hosted foundation** of FinSight, not yet the complete earlier v3 design archive. The full Spectrum/Execution Studio prototype remains available as a separate local project bundle for subsequent migration.
