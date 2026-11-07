# FinSight ATLAS — Phase 6: Intelligent monitoring and manually entered portfolio

## Delivered
- **Portfolio:** owner-only manually entered ticker positions, positive fractional shares, optional per-share USD cost; private Supabase RLS table. Indicative USD market values, position weights, concentration HHI, and conditional cost/P&L from Twelve Data quotes. If any quote is missing or non-USD, the full portfolio total and concentration claims are explicitly unavailable.
- **Historical portfolio risk:** separate user-triggered 1Y daily-history calculation for up to four entered holdings. Computes historical annualized realized volatility and observed daily return extremes from approximately 60 *aligned completed* daily returns. Uses current indicated market-value weights held fixed historically. This is neither a reconciled brokerage return nor a correlation matrix or forecast.
- **Alerts:** owner-only persisted ticker/threshold conditions for price above/below, absolute daily movement, 20-session annualized volatility, and relative volume. User presses **Check rules now** to fetch quotes and history. No scheduled monitoring, notifications, push, email, SMS, server background worker, or trades. Missing observations never create fake alerts.
- **SEC filings watch:** user-triggered lookup of the three most recent saved watchlist tickers, reporting most recent SEC 10-K, 10-Q and 8-K filing links and whether filing dates fall within the previous seven calendar days. Not a new-since-last-seen detector or real-time notifications.
- **Research journal:** owner-only persistent research theses with ticker, title, status, optional HTTPS evidence URL, status changes, and delete. Tracks journal entries, not trade orders.
- **Unified intelligence:** Overview hub summarizing actual private holdings, enabled rule counts, latest journal and research records. The summary API does not hit external providers or invent portfolio valuations.

## Manual activation
1. Open Supabase > SQL Editor.
2. Run **supabase/migrations/202611070003_phase6_portfolio_alerts_journal.sql** (idempotent DDL and RLS policies). This does not alter Phase 5 tables, watchlists, previous research or provider secrets.
3. Sign in at your Vercel deployment.
4. In **Portfolio**, enter a small test position and check that it persists after refresh. The quote may be absent due to provider availability.
5. In **Alerts**, save a positive threshold, click *Check rules now*, then delete the test rule. Note prices and times are provider-reported and potentially delayed.
6. In **Journal**, add a short research thesis, update its status, and refresh.
7. In **Overview**, select *Refresh* and verify the saved private-record counts.
8. Optional: in Portfolio, press *Calculate historical risk*, and in Alerts press *Check official filings*. These use actual provider calls and may be rate-limited.

## User data and safety boundaries
- No brokerage credentials, actual executed transactions, tax lots or cash accounts.
- Stored quantities and costs are user-entered. Overwriting an existing ticker replaces its entire recorded position (not an execution log).
- Quote data is indicative, not real-time guaranteed. FX conversion is deliberately not performed. P&L excludes fees, tax, dividends, splits/corporate actions and transaction timing.
- Risk model assumes current weights held fixed for all historical returns. It is a simplified approximation, not a calibrated VaR model or portfolio recommendation.
- Alerts are **manual checks only** and do not poll while the app is closed.
- SEC filing checks use official filings and a bounded, server-side user-agent request. A filing being tagged *recent* does not mean the system notified you when it appeared.
- Small, bounded batches are used to limit external API costs. If the provider quota is exhausted, an error/missing-data state is shown.
- Supabase RLS policies restrict direct table access to each authenticated user's own rows. Server API checks also enforce `FINSIGHT_OWNER_USER_ID`.

## Known future extensions (NOT delivered as this release)
- Scheduled monitor worker with opt-in alerts and delivery controls.
- Track last-seen SEC accession and source-deduplicated notifications.
- True multi-asset portfolio risk aggregation using a cash ledger, securities transaction events, splits and dividends.
- Portfolio risk attribution, beta, correlations and benchmark comparisons.
- Research journal revision history / note attachments, full thesis audit.
- Custom portfolio target weights, risk budgets and returns reporting.
