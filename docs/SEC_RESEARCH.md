# FinSight ATLAS — Milestone 4 research and SEC integration

## Activation (one additional mandatory Vercel environment variable)
The official SEC EDGAR data feeds are public and do **not** require an API key. Automated downloads do require a truthful User-Agent with the application's name and a working contact email.

1. Open Vercel > FinSight AI > Settings > Environment Variables.
2. Add `SEC_USER_AGENT` for Production. Value format: `FinSightAtlas your-monitored-email@your-domain.com`. **Replace this example with an email you control; do not post it to GitHub.**
3. Redeploy the latest `main`.
4. Sign in to FinSight > SEC filings, enter `NVDA`, and select **Retrieve SEC filings**.
5. Verify dates, CIK, official 10-K/10-Q/8-K filing links, and any available structured XBRL facts.

The SEC asks automated clients to identify themselves and limit request rates. See the official docs:
- https://www.sec.gov/search-filings/edgar-application-programming-interfaces
- https://www.sec.gov/about/webmaster-frequently-asked-questions
- https://www.sec.gov/search-filings/edgar-search-assistance/accessing-edgar-data

No user contact address is hardcoded or published by this repo.

## Optional LLM synthesis (may incur charges)
By default, FinSight uses deterministic evidence summaries with **no LLM API charge**. If you explicitly want natural-language AI synthesis:
1. Create an API key from your own OpenAI API account and set a strict budget there.
2. Add server-only `FINSIGHT_OPENAI_API_KEY` to Vercel; optionally set `FINSIGHT_LLM_MODEL` to a model available to your API account (default `gpt-6-luna`).
3. Redeploy. The server calls the OpenAI Responses API with `store:false`, bounded input, and an output token cap.
4. Only user-entered research questions and retrieved market/SEC evidence are sent for synthesis; no brokerage holdings are connected, and server secrets aren't included in the model input.
5. If the model is unavailable, rate-limited, fails or cites an unknown source ID, FinSight falls back to evidence-only output. Model prose is **not mechanically verified for factual accuracy**; always inspect linked SEC sources.

Never use a `NEXT_PUBLIC_` prefix for these keys. Don't paste them into chat or push them to public GitHub. ChatGPT Plus does not include separate OpenAI API billing.

## API contract and auditability

- `GET /api/sec/filings?symbol=NVDA` — owner-authenticated SEC ticker → official CIK → recent filings with direct archive URLs and selected XBRL revenue/net income facts. Input validated; official HTTPS hosts are hard-coded; user-supplied URLs cannot be proxied.
- `POST /api/agent/trace` — SSE updates for graph nodes (router, market, risk, filings, parallel combined, synthesize, persistence), with actual completed-node timings, source list, answer and persistence status.
- `POST /api/agent/demo` — non-streaming owner-authenticated result with evidence sources.
- The input parser tests SEC accession/filename validation; `npm run test:signals` runs the SEC regression tests alongside the existing financial-indicator and symbol-recognition tests.

## Evidence rules

- The filings panel shows metadata from SEC submissions (10-K, 10-Q, 8-K), not invented descriptions.
- Every displayed structured XBRL figure must have a recent SEC filing accession and matching reported period date. US-GAAP concepts can be absent or different between companies.
- The app does not claim to extract Item 1A risk factors or read the full filing text yet. A direct official filing link lets the user read the original.
- The LLM is asked to use only retrieved evidence and known source IDs. It is *optional*. It does not generate new citations or URLs for the UI.
- The system distinguishes limited, unavailable, and provider-backed evidence. A failure is not replaced with synthetic financial metrics.
- Source dates and retrieval timestamps are exposed; quotes are not necessarily real-time.
- The system does not yet have a document chunk store, embeddings, comprehensive RAG retrieval, a true portfolio risk engine, or financial advice.

## Acceptance cases

- Valid NVDA: show actual issuer, current CIK mapping, recent official filings and dates.
- Invalid ticker: HTTP 400; unrecognized issuer: HTTP 404 with meaningful error.
- Missing SEC_USER_AGENT: setup message, not invented filing data.
- SEC access denied: show clear SEC-specific status.
- XBRL unavailable: show filing list with warnings, never a fabricated figure.
- AI research: “Summarize NVIDIA's latest SEC 10-K and 10-Q” routes to filings and lists documentary evidence.
- Combined research: “Assess NVIDIA volatility and SEC filings” routes to combined, with risk and SEC nodes running concurrently.
- Research history and SSE timeline save accessible records under Supabase owner.
- No-key mode: evidence-only summary, no external LLM call.
- Optional-key mode: source-linked AI narrative, with fallback if provider unavailable.
