# FinSight ATLAS — Phase 7 daily research monitoring

## Implemented

- Protected `GET /api/cron/monitor`, scheduled once daily by Vercel at **22:00 UTC**, via `vercel.json`. On Hobby the invocation may occur during that hour, and cron execution is not a delivery SLA.
- Separate server-only Supabase privileged client (not the SSR cookie client) for scheduled work. Both a correctly formatted `Authorization: Bearer CRON_SECRET` header and the environment-side owner identifier are required. A missing secret fails closed with HTTP 401.
- **Opt-in default:** migration creates no enabled monitor settings; server returns `disabled` unless owner explicitly activates it in Monitoring.
- Daily unique `(user_id,run_day)` row prevents duplicated scans from repeat invocations or manual+cron overlap.
- Bounded scan of at most **three distinct enabled alert-rule tickers**; up to two latest saved watchlist tickers for SEC new-accession detection. Quotes and histories are pulled as needed; no fabricated values.
- Stateful edge detection suppresses repeated threshold events while a condition stays true. An actual negative observation rearms the rule; missing data does not. Historical signal evaluation uses the completed bar date.
- First successful SEC lookup **seeds a baseline** instead of alerting on all pre-existing filings. Later scans report newly appearing SEC accession numbers. If the prior accession falls out of the bounded window, the baseline is reseeded rather than guessing.
- Private alert-event inbox with read/unread actions, latest run outcomes, source links, and optional email delivery.
- Optional **Resend** delivery using configured, verified sender and a fixed recipient, only after owner turns on email. Uses event-ID idempotency keys. Provider failures are recorded; this is not a certified exactly-once delivery system.
- Owner-only **Run today's scan now** for acceptance testing; it consumes the same one-run-per-UTC-day allowance as Vercel cron and can use market API credits.
- Existing Phase 6 on-demand checks remain available independently.

## One-time activation — REQUIRED

1. Apply `supabase/migrations/202611070004_phase7_monitoring.sql` in Supabase SQL Editor.
2. In **Vercel > Project > Settings > Environment Variables** set **Production-only**:
   - `CRON_SECRET`: generate a unique high-entropy random string (at least 24 characters). Never use the Supabase password or paste it into source code.
   - `SUPABASE_SECRET_KEY`: copy the server-side secret key from Supabase API Keys. The older service-role key also grants privileges but this implementation expects the **new secret key** in this variable. Never set a `NEXT_PUBLIC_` prefix or expose the key.
   - Keep existing `NEXT_PUBLIC_SUPABASE_URL`, `FINSIGHT_OWNER_USER_ID`, `TWELVE_DATA_API_KEY`, and `SEC_USER_AGENT`.
3. **Optional email** (leave blank if not wanted):
   - `RESEND_API_KEY`: your own provider key.
   - `MONITOR_EMAIL_FROM`: verified sender address at your domain.
   - `MONITOR_EMAIL_TO`: a recipient address you control.
   - Email may require domain verification, and provider usage may incur charges. The app never infers an email recipient from the user's session.
4. Redeploy the current `main` **after adding environment variables**. Check Vercel Cron Jobs lists `/api/cron/monitor`.
5. Sign in to the app, open **Monitoring**, and confirm scheduler configuration shows ready.
6. Click **Enable daily scheduled scan** (optional: SEC detection). Click **Save monitoring preferences**. **Email remains off** unless you separately opt in.
7. Click **Run today's scan now** to inspect the first actual monitor run. It can record zero alerts (valid) or partial provider failures. Subsequent attempts on the same UTC day return `duplicate`.
8. Refresh Monitoring: inspect the run history and any in-app events. To test a true threshold event, configure a rule with a threshold clearly crossed by real provider observations; avoid depending on a guaranteed match.
9. A successful first SEC run baselines existing filings; a brand-new filing must appear after that baseline to generate a filing event.

## API and database

- `monitor_settings`: explicit monitoring preferences; browser CRUD owner-only under RLS.
- `monitor_runs`: one row per owner/UTC day; scheduled-run audit and error diagnostics.
- `monitor_events`: deduplicated threshold and SEC events; source URLs and email status; owner can only update `read_at`.
- `monitor_rule_state`: rising-edge trigger state.
- `monitor_filing_state`: latest known accession per issuer.
- `GET/PUT/PATCH /api/monitor`: authenticated owner-only preferences, history and mark read.
- `POST /api/monitor/run`: authenticated owner-triggered scan, same dedupe rules.
- `GET /api/cron/monitor`: secret-authorized server cron without a user cookie.

## Free-tier and security limitations

- Vercel daily cron will not deliver sub-hour or intraday monitoring, and does not guarantee exact execution time.
- On-demand and scheduled paths both consume Twelve Data/SEC provider resources. Scan limits are intentionally conservative; not all watchlist symbols or rules are scanned each day.
- The daily run lock is **at-most-once attempt** per UTC day, not a distributed job-queue with retries. A partial or failed run is visible but will not automatically be retried the same day.
- Event records are deduplicated by rule+observation timestamp and issuer+accession; this is not exactly-once email delivery.
- Email status `failed` is recorded and is not automatically resent. The system avoids spammy retries.
- Free-tier mail usage/verification requires an independent provider account; setting the email toggle with no provider configuration is prohibited.
- No personal trading, brokerage execution, portfolio rebalancing, financial recommendations or price forecasts.
- Deployment success proves build and cron registration, not that privileged secrets have been configured or that a scheduled scan has executed against the user's database.

## Production acceptance checklist

- Missing/wrong cron auth: HTTP 401, no data leaked.
- Migration absent: owner Monitoring UI explains what is missing; scan remains inactive.
- Settings disabled: scheduler reports disabled and does not hit external market providers.
- First monitor run: creates one `monitor_runs` row and at most one event per rising edge.
- Repeated manual/cron scan that UTC day: duplicate, without extra market queries.
- SEC first poll: baseline only; later genuinely new accession: event once.
- Provider errors: partial run and no invented alert; rule state preserved.
- Email disabled: no external mail request; email enabled: only owned configured address targeted.
- Inbox mark read/unread and run history persist on refresh.
