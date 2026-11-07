# FinSight ATLAS — Twelve Data configuration

## Why this provider?
Twelve Data's Basic tier currently advertises 8 API credits per minute and 800 per day for personal testing, with US equities and ETFs. API coverage and data entitlements vary. Check official pricing before using: https://twelvedata.com/pricing

## Activate
1. Create a free account at https://twelvedata.com.
2. Copy your API key from the Twelve Data dashboard.
3. In Vercel > FinSight AI > Settings > Environment Variables add `TWELVE_DATA_API_KEY` (Production; **server-only**, no NEXT_PUBLIC prefix).
4. Redeploy the latest main commit.
5. Sign in to FinSight and open Markets; search for AAPL, select it, and inspect the chart.
6. Go to Portfolio/Markets and save a symbol to your Supabase watchlist; refresh to verify persistence.

## Contract
- `GET /api/market/search?q=apple` returns matching US stocks.
- `GET /api/market/quote?symbol=AAPL` returns the latest available quote.
- `GET /api/market/history?symbol=AAPL&period=1M` returns time-series OHLCV.
- `GET /api/market/watchlist?symbols=AAPL,MSFT` returns up to four quotes with per-symbol errors.
All endpoints require the configured owner session, validate inputs, and do not expose the API key.

## Data integrity
No stock prices are invented. Without an API key, the UI displays a clear connection/setup state. Quote timestamps and source are displayed, not assumed to be live; the provider may restrict intraday data on Basic. Shorter periods may fail gracefully if your plan doesn't support those intervals. Prices are informational and not trading instructions. Cached quotes/series reduce free-tier credit usage, but providers may still count calls during cache revalidation.

## Reliability and research boundaries
- Quote requests are cached for 120 seconds, historical series from 2 minutes to 6 hours depending on period, and symbol searches for one hour through Next.js server-side fetch caching. Cache revalidation is best-effort and may serve an older observation briefly.
- A provider 429 activates a 60-second **per-server-instance** cooldown. Serverless instances do not share this circuit-breaker state; this is not a globally enforced budget.
- The watchlist requests no more than four symbols. Each symbol is independently reported as available/unavailable. This does not imply market prices are real-time.
- LangGraph market route only consults a provider quote when it recognizes an explicit supported ticker. The output reports source/timestamp or an unavailable state, never inferred market prices. Portfolio risk and SEC filings remain unconnected, with explicit limitations.
- A cache may reduce API-credit consumption, but does not guarantee a particular quota usage. See https://support.twelvedata.com/en/articles/5615854-credits.
