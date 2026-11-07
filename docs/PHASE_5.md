# FinSight ATLAS — Phase 5: Research quality, evidence review and observability

## Scope delivered

### 5.1 Better document ingestion and labeled evaluation
- Server-only SEC archive downloader validates official filing URLs and the SEC identification header, enforces an 18-second request timeout, caps each document at 7.5 MB, and applies a 60-second *per-instance* cooldown after SEC 403/429 responses. It never proxies user-supplied URLs.
- Extracted text can use up to 840,000 normalized characters (previously 280,000), with up to 1,200 overlapping, section-bounded windows. The downloader and extractor report partial coverage rather than silently treating unexamined content as absent.
- This remains a bounded prototype: some SEC annual reports exceed these limits or contain complex tables; heading parsing remains heuristic. The increased cap is not equivalent to full SEC document ingestion.
- A fixed-source lab compares weighted keyword/BM25 on three public issuer filings, but the 3 phrase anchors are not independent adjudicated evaluation labels.
- A private **reviewer queue of 36 unlabeled candidate questions** (12 each for NVDA, MSFT and AAPL) helps collect human judgments. The queue is *not* a ready-made 36-case ground-truth benchmark.
- Reviewer-approved relevant / unsupported / uncertain decisions are stored per owner in Supabase with row-level security. The quality dashboard shows selectively reviewed relevance shares with a clear sampling caveat.

### 5.2 Claim screening and review
- Optional AI synthesis now falls back to deterministic evidence if citations are unknown, absent, or any screened claim has unsupported numbers or low lexical overlap with retrieved observations.
- The claim checker never marks free-form claims as factually verified. It is a conservative **screen**, not semantic entailment or fact-checking.
- Research Briefings offer a human review action per AI claim and source-linked evidence. A reviewer can label a claim supported, unsupported, or uncertain.
- A definitive claim-level correctness rate requires an independent, adequately labeled dataset and adjudication. This milestone supplies collection and screening infrastructure, **not** a certified factual-accuracy rate.

### 5.3 Structured research report UI
- Execution Studio now renders a titled research briefing, dated source inventory, market observations, historical risk measurements, SEC evidence, explicit gaps, and optional AI claim audit.
- The full unformatted LangGraph answer remains accessible in a collapsed raw response.
- The report object is included in the SSE result and saved trace. Saved research retains prior source links.
- Source IDs are references into retrieved sources, not a guarantee that a claim is entailed.

### 5.4 Reliability and observability
- The Quality Lab exposes recent owner-visible run/trace counts, source coverage among stored traces, actual node p50/p95 durations, recorded failures and manually reviewed labels.
- Aggregation reads at most the newest 100 records: there is no background alerting or global distributed telemetry. Missing traces can bias summary results.
- Existing Twelve Data provider caching and per-instance rate-limit cooldown remain; SEC downloads also have a bounded cooldown and response limits.
- SEC passage search returns document bytes processed, extraction completeness, section count and download durations.
- The benchmark's 11 hand-authored synthetic cases remain automated CI regressions with a report artifact; no live SEC fetch occurs in CI.

## One-time database setup required

Execute **supabase/migrations/202611070002_phase5_evaluations.sql** in your Supabase project's SQL Editor. It creates `research_evaluations` with owner-only row-level security and a strictly limited insert/read/delete policy. It does **not** alter existing watchlists or research history. Until migration is applied, Phase 5 reviews will show an explicit setup error and the Quality Lab will show saved-trace metrics without review counts.

## Acceptance walkthrough

1. Sign in, open **SEC filings**, retrieve NVDA, and use **Find cited passages**. Inspect document-coverage diagnostics and actual source links.
2. Mark one passage as relevant, unsupported, or uncertain. The review is saved only after the API confirms the write.
3. Open **Execution Studio**, ask `Assess NVIDIA volatility and its latest SEC 10-K disclosures`. Inspect the structured report and available citation sources. Optional AI narrative remains disabled without an API key.
4. Open **Quality lab** from the sidebar or Execution Studio. Load metrics; check p50/p95 are present only for executed nodes with saved trace events.
5. Review the 36 **candidate** questions in Quality Lab. These are prompts needing actual source checking, not existing labels.
6. Verify that an unavailable provider, missing source, partial SEC extraction or an ungrounded AI claim is clearly reported rather than replaced with a fabricated conclusion.

## Release boundaries

- *Implemented and automated-tested* does not equal *live-verified against the user's authenticated production configuration*.
- The lab does not yet contain 30–50 independently human-adjudicated examples. It has 36 **unlabeled prompts** and collection/storage tools. Human evidence review is required to produce that dataset.
- We have not introduced an always-on observability vendor, persistent distributed circuit breaker, fully semantic SEC index, or automatic factual-entailment certification.
- No payment or LLM API key is required for deterministic research or lexical retrieval; optional paid embeddings and AI synthesis are explicit choices.

## Engineering references
- [SEC document extraction and integration](SEC_RESEARCH.md)
- [Lexical/BM25 retrieval evaluation](RETRIEVAL_EVALUATION.md)
- [SEC fair access](https://www.sec.gov/about/webmaster-frequently-asked-questions)
