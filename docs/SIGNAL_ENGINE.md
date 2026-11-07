# FinSight ATLAS — Milestone 3: Historical Market Signal Engine

## Inputs
- Twelve Data 1Y daily OHLCV time series (up to 260 bars) per instrument.
- Excludes the current US exchange-date bar **even if the session has just closed**; this conservative rule avoids attributing an incomplete volume bar to the full trading session.
- Processes bars by date in ascending order, no future data or training involved.
- Scans one to four tickers **on demand** rather than polling, in batches of at most two.
- Uses the 1Y historical cache from the Market Explorer. Twelve Data daily history is 1 API credit per symbol according to provider documentation.

## Metrics
1. **20-session momentum:** 100 × (last close / close 20 completed trading sessions ago − 1).
2. **60-session momentum:** analogous 60-session price change.
3. **20-session realized volatility:** sample standard deviation of 20 daily log returns × √252 × 100 (% annualized).
4. **Relative volume:** last completed session volume / mean of the preceding 20 completed session volumes (at least 15 prior positive volume observations).
5. **90-session maximum drawdown:** smallest (close / running peak − 1) over the trailing 90 observed sessions × 100.

If a required sample is unavailable, the metric is null (not zero). A composite score is null unless all four scoring metrics have sufficient data.

## Attention score (0–100), informational only
- Absolute 20-session momentum contributes up to 30 points: min(30, abs(momentum%) × 1.5).
- Relative volume contributes up to 25 points: min(25, max(0, ratio−1) × 20).
- Annualized volatility contributes up to 25 points: min(25, annualized vol% / 2.4).
- Absolute drawdown contributes up to 20 points: min(20, abs(min(0, drawdown%)) × 0.8).
- Activity buckets: score below 35 = lower, 35–64 = moderate, 65+ = higher.

Higher scores can be produced by sharp **downward** moves and volatility. No ranking by expected upside, accuracy claims, entry timing, buy/sell direction, or future returns are implied. Coefficients are heuristic and not fit or calibrated on historical outcomes.

## API contract
`GET /api/radar?symbols=AAPL,NVDA` returns per-symbol signal reports, source, last bar timestamp, explanation, score components, and partial errors. Requires owner authentication and server-side Twelve Data key. No data is persisted during a scan.

## Known limitations
- No price adjustments for splits/dividends are implemented; corporate actions can distort returns and volatility.
- No market-benchmark comparisons, transaction costs, portfolio holdings, or forward-return backtests in this milestone.
- No globally coordinated provider rate limiter; existing 60-second cooldown is per Vercel instance.
- Cache staleness is possible and source timestamps should always be inspected.
- The result is **historical single-stock activity analysis**, not a comprehensive portfolio risk model or predictive investment system.

## Planned verification
- Authenticate; scan AAPL and SPY; verify data and sample dates.
- Confirm missing data returns explicit errors rather than fabricated metrics.
- Scan two symbols and inspect score explanation.
- Verify endpoints reject unauthorized requests and invalid symbols.
- Run deterministic local unit tests in CI for flat-price series, positive/negative momentum, missing volume and short histories.

## Exploratory forward-outcome event study
- For every eligible historical observation starting after 61 bars, calculate a score using only observations up to and including that date.
- If its attention score is 65 or greater, observe the close-to-close percent change five completed trading sessions later.
- Show event count, average subsequent five-session percent change, fraction of positive event outcomes, and average unconditional five-session return across eligible observations.
- These outcome windows can overlap, so observations are not independent. An observation at the closing price is not an assumed executable trade. No corporate-action adjustment, costs, slippage, confidence intervals, benchmark adjustment, out-of-sample evaluation, or predictive significance claims.
- If there are no events, report no performance statistic. It must not show 0% performance for absent observations.

## Research question entity recognition
The deterministic LangGraph demo recognizes selected company names (including NVIDIA → NVDA) as well as exact tickers and explicit $SYMBOL references. This is not yet a general company entity resolver. Unrecognized names report that limitation; provider failures are distinguished from failed company recognition. Regression tests cover NVIDIA phrasing and token-boundary behavior.
