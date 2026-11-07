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

## Milestone 4 — SEC research intelligence

FinSight now includes a dedicated SEC EDGAR filings view, first-party issuer CIK lookup, recent 10-K/10-Q/8-K filing links, and selected XBRL financial facts. Its LangGraph workflow combines filing metadata with historical market risk where the question warrants it, displays timed node execution and verified source links, and saves results to Supabase. AI prose synthesis is optional and disabled by default. **SEC access requires an application-specific User-Agent with a real contact email configured only in Vercel**. See [Milestone 4 setup and limitations](docs/SEC_RESEARCH.md).

### Retrieval-quality regression suite

Milestone 4 includes a synthetic SEC-style labeled benchmark with Hit@1, Recall@3, MRR, and a limited false-positive measure. It runs in GitHub Actions and uploads the case-level report as an artifact. These are **synthetic regression checks, not verified performance on real filings**. See [evaluation methodology](docs/RETRIEVAL_EVALUATION.md).

### Fixed-source SEC retrieval comparison (on demand)

In the SEC filings tab, the **Real SEC retrieval lab** runs bounded, owner-only comparisons against fixed official 10-K sources from NVIDIA, Microsoft, and Apple. It compares our weighted lexical ranker with BM25 and reports source coverage and evidence-anchor rank. An optional embeddings-based **candidate reranker** is available only after explicit user opt-in and configuring a server-only OpenAI API key; it may incur costs. The experiment is not a statistically meaningful production benchmark. See [evaluation details](docs/RETRIEVAL_EVALUATION.md).
