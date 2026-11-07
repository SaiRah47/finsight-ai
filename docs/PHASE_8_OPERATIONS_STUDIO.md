# FinSight Agent Operations Studio — visually observable research debate

## What this release adds

The **Agent Operations Studio** appears inside **Agent arena** after Season 1 is initialized. It is a light, high-contrast dashboard integrated with existing owner-only research infrastructure, with interactive investor personas, a real server event-driven workflow, role inspection, structured debate, source evidence wall, final guardrail view, and saved session replay.

The workflow is executed server-side and streams stage start/completion events. Visual progress corresponds to actual work, not animated mock progress.

### Five observable sub-agent roles

1. **Research Analyst:** retrieves a USD market quote, completed-session volatility and momentum, plus official SEC filing metadata. Each observation retains its source, value and date; failures remain explicit.
2. **Strategy Architect:** forms a constrained investment thesis aligned with the selected agent's predefined stock universe and philosophy.
3. **Red-Team Critic:** challenges the strategy's assumptions and can disagree. It receives the earlier reasoning so the critique addresses the actual thesis.
4. **Risk Guardian:** deterministic hard guardrail; missing valid quote or sparse evidence can veto an actionable thesis.
5. **Decision Council:** resolves the arguments into `consider`, `hold` or `abstain`, **not a trade order**.

### AI vs. deterministic execution

- When `FINSIGHT_OPENAI_API_KEY` exists, Research, Strategy and Critic attempt independent model calls through the Responses API. The existing `FINSIGHT_LLM_MODEL` setting can specify the model.
- Each optional model call is time-limited. When a model fails, outputs invalid citations, or invents numerical evidence, that stage transparently falls back to **rules-based analysis**.
- The UI labels every role as **AI reasoning** or **Rules fallback**. Risk screening and final decision remain deterministic.
- Evidence facts from SEC filings are **metadata only in this release**; the system does not invent or paraphrase unexamined SEC passages. Detailed passage search remains in the existing SEC intelligence workflow.
- These are source-constrained, structured model opinions, not verified counterfactual proof, alpha forecasts or an end-to-end autonomous trader.

### Ownership and persistence

- Apply `supabase/migrations/202611070008_phase8_agent_operations_studio.sql` after the existing Season 1 migration.
- Owner-only `GET /api/arena/studio?agentId=<uuid>` retrieves saved runs.
- Owner-only `POST /api/arena/studio` streams actual server stage events with `text/event-stream`, then saves the final audit in `arena_orchestration_runs`.
- All API endpoints require the existing owner session. The storage table is protected by owner-only RLS and authenticated users have read access to their own rows; the privileged server holds write access.
- An owner/team cooldown discourages repeated API-cost spikes.
- Session history includes actual elapsed stage times, citations, critic position, risk veto, provider coverage and explicit limitations.
- It never writes to `arena_orders`, `arena_positions`, `arena_agents`, `arena_strategy_control`, or shadow-tournament tables.

## Manual activation

1. In Supabase SQL Editor, run the new migration linked above. Previous Arena holdings and strategy versions remain unchanged.
2. Open your deployed FinSight and sign in. Open **Agent arena → Agent Operations Studio**.
3. Select AI Maximalist, AI Skeptic, Magnificent Seven Purist or Value Investor.
4. Click **Run full research debate** and watch the five nodes display actual stage changes.
5. Inspect each completed node, the Debate Chamber, the Evidence Library, and the Decision Audit.
6. Select another agent. Compare differences in its philosophy and debate outcomes.
7. Refresh the browser, choose a saved session in the left rail, and confirm the complete audit can be replayed.
8. To enable genuine optional model-generated role deliberations, verify `FINSIGHT_OPENAI_API_KEY` and `FINSIGHT_LLM_MODEL` in Vercel. Without an API key the interface clearly indicates deterministic fallback. Never expose server keys in public/client environments.

## Explicit non-features

- No automatic trades, no changes to existing $5,000 paper accounts, and no strategy promotion.
- No new scheduling or background autonomous investing; the owner starts a research workflow.
- No independently audited truthfulness guarantee for LLM text. Numeric/citation screens are conservative heuristics, not semantic entailment.
- No claims of profitable strategies, learned alpha or successful debate outcomes without actual forward-paper evidence.
- No full-text SEC risk review in this version of the Studio. Use the SEC workflow for that.
- This Studio improves **observability and reasoning**, not investor performance by itself.

## Next quality milestones

- Rich claim-to-source highlighting and deeper SEC excerpts for each participant.
- Allow the critic to request targeted re-research, bounded by a cost/latency budget.
- Record and compare versions of debate prompts, hypotheses and agent reasoning with out-of-sample evaluations.
- Add streamed partial model replies only if technically validated against source-grounding rules.
