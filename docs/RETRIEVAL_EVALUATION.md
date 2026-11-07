# SEC retrieval evaluation — engineering quality gates

This project now runs a deterministic benchmark whenever GitHub Actions builds the app.

## Dataset and limitations
- `tests/fixtures/sec-retrieval-cases.ts` contains **11 entirely fictional, hand-authored SEC-style examples**: eight answerable questions and three deliberately irrelevant questions.
- The fixture documents contain no live SEC data. Their labels are exact substrings. These tests are regression checks, **not** empirical evidence of real-world SEC retrieval quality or RAG answer correctness.
- Inputs cover cybersecurity, supply chain, competition, liquidity, revenue, margin, operating cash flow, noisy generic risk language, and unanswerable questions.
- Future work is to add a separately maintained **real-filing human-judged holdout dataset**, diverse filings and issuer formats, and evaluation of citation entailment. Do not use the synthetic fixture score to claim production retrieval accuracy.

## Metrics
- **Hit@1:** fraction of answerable cases where the top returned passage includes the exact labeled evidence span.
- **Recall@3:** fraction of answerable cases where any of the top three passages contains the span.
- **MRR:** mean reciprocal rank of the first relevant passage among answerable cases.
- **False-positive rate:** fraction of explicitly unanswerable questions that still return any passage. This proxy does not prove that retrieval is generally calibrated to abstain.

## Current CI gates
- Hit@1 >= 0.625
- Recall@3 >= 0.75
- False-positive rate <= 0.34

The floors are modest safeguards against regression, not release-readiness criteria. MRR is logged without a threshold to avoid overfitting this tiny set.

## How to run
```bash
npm run test:signals
npm run eval:retrieval
```

The second command writes `retrieval-eval-report.json` containing per-case hit ranks and summary metrics. GitHub Actions uploads the report as an artifact called **retrieval-evaluation** on each run, keeping it out of version control. Never copy evaluation scores into promotional claims without stating the synthetic-data caveat.

## Ranker version
The lexical ranker weights exact question terms higher than expanded synonyms, saturates repeated words, applies heading relevance, and de-duplicates overlapping chunks. It is deliberately transparent and free of model/API spending. Relevance scores are arbitrary lexical ranking values, **not confidence probabilities**.

## Next research gate
Establish a small human-reviewed benchmark drawn from public 10-K/10-Q sections with exact accession/source locations, then measure hit@k, MRR, abstention, extraction coverage, and latency. Only test embeddings/vector search if the real-data holdout demonstrates a measurable quality gap. Compare providers/versions on the same frozen corpus to avoid cherry-picking.
