# Phase 8 — FinSight Agent Arena, Season 1 (foundation release)

## Scope

The Arena is a **paper simulation**, not live brokerage execution, investment advice, or validated agent alpha. Each of seven separately managed agent accounts begins with exactly $5,000 virtual cash; no actual money or trades.

Four deterministic **Investor League** agents are active:
- AI Maximalist — AI infrastructure/software permitted universe.
- AI Skeptic — non-Mag-7 staples, healthcare and utilities permitted universe.
- Magnificent Seven Purist — seven named constituents only.
- Value Investor — stable business/value-themed permitted universe (the first version **does not** automatically calculate valuation metrics).

Three **Trading League** agents are explicitly paused: Momentum, Mean Reversion, Opening Range. We do not fabricate intraday fills from daily closing prices.

Season 1 strategy *proxies* select universe symbols by deterministic round-robin rotation; this is a reproducible baseline, **not** the future multi-agent Research → Strategy → Critic → Risk system. No unsupported claim of model-intelligent stock selection is made.

## Runbook

1. Apply [SQL migration](../supabase/migrations/202611070005_phase8_agent_arena.sql) using the Supabase SQL Editor. This creates five RLS read-only owner tables and a **privileged-only atomic order RPC**.
2. Keep `SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `FINSIGHT_OWNER_USER_ID`, and `TWELVE_DATA_API_KEY` configured in Vercel. No additional secrets.
3. Redeploy main if environment variables changed; no redeploy is needed solely for applying the SQL migration.
4. Open **Agent arena → Initialize virtual accounts** once. Repeating initialization never resets virtual cash or past orders.
5. Select **Run investor cycle**. Four independent agents each receive one buy/hold decision per UTC day, subject to available quote and cash. Repeating in the same UTC day does not generate a second order.
6. Select **Refresh quoted leaderboard** to fetch USD provider quotes and display indicative paper equity/return. A missing quote shows *unavailable* rather than inventing a total.
7. Inspect immutable order and decision audits; trading league stays paused. Refresh to ensure persistence.

## Paper execution and ledger rules

- All virtual orders are executed atomically via `arena_execute_virtual_order` with per-agent row locking, sufficient cash/position checks, and idempotent request IDs.
- Virtual cash remains nonnegative. Whole shares only. Buys are capped by 20% of original $5,000 balance (up to $1,000 notional before modeled slippage).
- Buy fills are modeled at provider-reported quote plus **10 basis points slippage**. Commission assumption is zero; these are **not real executable bids/asks**.
- Cycles are triggered by authenticated owner request; they are not automated daily yet. **Buy orders are blocked outside a conservative weekday New York regular-session window (9:35–15:55 ET), and when provider quote observation date is not today's New York market date.** The clock check does not independently implement the NYSE holiday calendar; observed prices may still be delayed. Weekend cycles record honest holds rather than fictitious fills. No borrowing, leverage, short selling, options, crypto, tax lots or real brokerage account.
- Decision and order records are append-only in the application; owner has read-only grants, not direct write permissions. Server uses the service-role key for controlled state changes.
- Performance is only estimated when each positive-share holding has a valid USD quote **with an observation date**. Paper return is `(equity - $5000)/$5000`.
- Price snapshots are provider-reported and may be delayed. Missing or stale timestamps are disclosed; no Sharpe ratio or drawdown is shown before historical daily equity snapshots exist.
- Seeding an agent with cash does not create fake historical return series or a 90-day experiment.

## Important limitations

- A deterministic simulation is a foundation for an agentic arena, not itself an autonomous decision-maker.
- The currently implemented initial strategy is universe rotation. True AI skeptical/value analyses, disagreement debates, evidence-based trade approvals, and risk-aware selling are a **subsequent iteration**.
- Investor vs intraday-trader return comparisons remain disabled until intraday historical bars, commission/slippage models, timezone/session rules and lookahead checks are available.
- Correct league comparisons will also require risk metrics, turnover, benchmark selection, corporate actions, and dated mark-to-market snapshots.
- Paper equity is not a realized brokerage account statement. No real investment outcomes have yet been observed.

## Future development roadmap

1. Daily stored mark-to-market valuations and comparable market benchmarks.
2. Full constrained Research/Strategy/Critic/Risk agent workflow and thesis evidence audit.
3. Portfolio rebalancing/selling, risk budgets, position caps, and corporate-action adjustment.
4. Validated intraday feed, separate Trading League simulator and realistic fill semantics.
5. Historical replay with point-in-time datasets and strict look-ahead exclusion.

## Phase 8 learning lab — controlled improvement (new)

**Learning is deliberately not an unrestricted profit-maximizing feedback loop.** It separates observation, diagnosis, a research-only modification hypothesis, and future validation.

1. Apply `supabase/migrations/202611070006_phase8_agent_learning.sql` separately after the original Season 1 migration. It adds owner-readable, privileged-server-write-only `arena_equity_observations` and `arena_learning_reviews`. Existing positions, strategies, order history and cash are unchanged.
2. In **Agent arena → Agent learning lab** choose **Record session equity**. The server retrieves USD market quotes for actual held assets. Only complete, consistently dated weekday observations within the conservative age window are stored. Cash-only agents and missing quotes are not given fake market snapshots. Each observation is immutable and unique per agent and exchange date.
3. Choose **Review agent performance**. The server evaluates observed equity time series, reports preliminary return, maximum observed drawdown, negative day counts, and a limited standard deviation of session returns. At least 5 distinct observations are needed for early diagnostics; at least 20 before a *research-only* allocation-size hypothesis may appear when drawdown exceeds 8%.
4. All seven strategy identities remain unchanged. No proposed change can modify cash, order creation, or allocation settings. No self-training, shadow execution, or autonomous model edits have been implemented.
5. Repeated same-day review attempts return the existing stored review record. The UI shows the calculated report on the same data but does not pretend it creates additional observations.

### Fairness and risk limits
- Quote timestamps may be delayed. A market-date check does not establish every quote is contemporaneous or fully adjusted.
- Observed portfolio equity is not total-return adjusted for dividends, splits, taxes, and all market frictions.
- Drawdown can reflect market conditions rather than poor strategy design. Agents cannot reliably optimize profits from fewer than a significant number of forward observations.
- Future real self-improvement needs versioned strategies, frozen train/test splits, out-of-sample shadow portfolios, baseline benchmarks, risk-adjusted acceptance criteria, rollback, and explicit promotion approval.
- The `compareCandidateWithBaseline` utility offers a conservative paired-series prerequisite for future shadow tests but is not itself proof of model superiority.
