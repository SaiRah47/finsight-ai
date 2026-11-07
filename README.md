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

## Real market data (Milestone 2)

The Markets tab now includes US equity symbol search, server-side quotes, six selectable historical chart ranges, and quote stats. The overview uses the SPY benchmark, while saved watchlist symbols are looked up through authenticated APIs. These features require `TWELVE_DATA_API_KEY` in Vercel, under the free or paid entitlement of your Twelve Data account. Without a key the UI shows a connection prompt, never invented quotes. See [market-data setup](docs/MARKET_DATA_SETUP.md). Market-data API routes require an authenticated FinSight owner and use server-side caching. Quote timestamps are provider-reported and should not be assumed real-time.
