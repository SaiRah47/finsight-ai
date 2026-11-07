# FinSight ATLAS — Phase 8 Strategy Evolution & Shadow Tournaments

## What is implemented

The Arena now supports **versioned investor strategy parameters**, a **paired forward-paper shadow tournament**, **independent virtual cash and positions**, **one immutable daily session record per shadow experiment**, **conservative comparison gates**, and **owner-approved promotion / rollback**. A candidate can also be explicitly retired so a different experiment can be started.

The strategy difference tested in this release is the **maximum allocation per paper buy** (5–25%, compared with the incumbent v1 cap of 20%). This is *not* automated neural model self-training, not a portfolio optimizer, and not evidence of expected profit. The investor stock selection remains deterministic universe rotation. All Trading League identities remain paused.

## Activation

1. Apply the preceding Season 1 and Learning Lab migrations first if not already installed.
2. Open Supabase SQL Editor, run **`supabase/migrations/202611070007_phase8_shadow_tournaments.sql`**. It adds five RLS-protected, owner-readable tables and two server-privileged atomic SQL functions.
3. No new Vercel environment variables are required when `SUPABASE_SECRET_KEY` and `NEXT_PUBLIC_SUPABASE_URL` already work for the original Arena.
4. Open **Agent arena → Strategy Evolution Arena**. Select an Investor League persona and a different candidate allocation cap. Click **Create shadow experiment**.
5. While an eligible U.S. regular trading session is running, click **Run shadow session**. It uses recent, same-market-day USD quote observations for the target and all held positions. It records equal-date paired book equity or abstains with a clear error.
6. Daily experiments operate at most once per eligible observation date. Both competitors start with isolated $5,000 virtual balances, the same ticker selection sequence and quote observations, the same 10 basis-point assumed buy slippage and zero assumed commissions. The challenger differs only in its per-buy allocation cap.
7. **At least 20 paired observations** are required. Additionally, challenger paper return must exceed baseline return and observed maximum drawdown must not exceed baseline by more than one percentage point. These are mechanical gates, **not statistical proof of alpha**.
8. If the gate passes, enter a decision rationale and explicitly click **Approve paper promotion**. The transition is handled in a single privileged DB transaction with an optimistic active-version check. Only **future** Investor League order sizing changes. Existing cash, positions, order history, decisions, and shadow books remain intact.
9. **Rollback to baseline** restores the previous allocation setting for future paper decisions, with an auditable reason. An unpromising challenger can be **Retired** without ever changing the main account.
10. A promotion or rollback is permanently written to `arena_strategy_changes`. The changed active version can be read in the Arena's evolution panel.

## Data model

- `arena_strategy_versions`: numbered immutable candidate/baseline allocation parameters per agent.
- `arena_strategy_control`: active version pointer and prior pointer; live investor cycle checks this for sizing.
- `arena_shadow_experiments`: two independent $5,000 books, cash, positions, cycle counter, status and retirement rationale.
- `arena_shadow_steps`: a single, immutable, source-dated paired execution/valuation row per experiment/market day.
- `arena_strategy_changes`: promotion and rollback audit.
- `arena_record_shadow_step`: service-role-only transaction that locks an experiment, prevents duplicate session steps, inserts a paired mark and advances both shadow books atomically.
- `arena_switch_strategy_version`: service-role-only transaction with current-version check, minimum 20-session prerequisite, durable change history and rollback protection.
- `GET/POST /api/arena/evolution`: owner-authenticated experiment management. All writes to underlying ledgers occur through the trusted server-side Supabase privileged client.

## Validity and guardrails

- **No strategy is autonomously promoted.** A user must provide an explicit action and written rationale. Failed gating prevents promotion.
- The chosen target and held positions must all have positive USD quotes dated to the current New York regular-market session. A clock and date guard does not prove every quote is executable or independently exclude market holidays.
- A paper buy uses whole shares, no short positions, no leverage and up to its version's allocation of original $5,000 per cycle. A missing quote rejects the entire paired step rather than creating an unfair partial observation.
- Early sessions may reveal short-term variance, not reliably better investment decisions. The threshold of 20 observations is a minimum for preliminary testing, **not** a statistical-significance guarantee. Larger out-of-sample samples, benchmarks, confidence intervals, slippage sensitivity and bias checks remain future improvements.
- Forward shadow tournaments start together from $5,000; neither is retroactively compared against the existing live paper account's earlier trade history.
- Current tournament compares order sizing only. Future challenger types can introduce fact-grounded strategy evidence, risk signals and analyst-critic debates **without changing** the accounting and approval model.
- Existing earlier paper orders and their initial allocation assumptions are not rewritten by a strategy promotion.
- No investment recommendations, real money transfers or brokerage execution.

## Acceptance checks

1. The new migration applies, and all preceding Arena views still display their prior history.
2. Create a shadow experiment, reload, confirm two virtual cash books at $5,000 and correct candidate version number.
3. Attempt an off-hours shadow step: expect a clear no-fill response and no book changes.
4. On a regular market session, record one paired step; verify the same-day second attempt is deduplicated.
5. Attempt promotion before 20 paired sessions: no approval control / server rejection.
6. Confirm missing/stale market quotes reject a step rather than manufacture comparative equity.
7. Optionally retire an early candidate, confirm the original active strategy is unchanged, then start a new experiment.
8. After genuine paired evaluation and approved gate: promote with written reason, verify future order sizing, then rollback with reason. This last path cannot be fully live-validated until the minimum forward observation history exists.

Read the original [Phase 8 architecture](PHASE_8.md).
