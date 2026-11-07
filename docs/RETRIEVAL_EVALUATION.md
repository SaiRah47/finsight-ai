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

## Phase 2 — fixed-source, real SEC comparisons

Three pinned **official 10-K documents** have been checked against SEC public records:

| Company | Form / fiscal report | Official filing |
|---|---|---|
| NVIDIA (NVDA) | FY2026 10-K | [SEC original](https://www.sec.gov/Archives/edgar/data/1045810/000104581026000021/nvda-20260125.htm) |
| Microsoft (MSFT) | FY2026 10-K | [SEC original](https://www.sec.gov/Archives/edgar/data/789019/000119312526323660/msft-20260630.htm) |
| Apple (AAPL) | FY2026 10-K | [SEC original](https://www.sec.gov/Archives/edgar/data/320193/000032019326000026/aapl-20260926.htm) |

The server-only `POST /api/evaluation/real-sec` endpoint accepts just the hardcoded ticker names NVDA/MSFT/AAPL, never arbitrary URLs. It is owner-authenticated. The SEC filings screen includes a **Real SEC retrieval lab** with a Run button.

This live check uses a bounded 2.4 MB SEC download, and the text extraction additionally limits text and chunk counts. Microsoft’s FY2026 10-K is larger than that cap, so the runner may only observe a partial document and may not contain the selected answer anchor. The result explicitly flags **partial** or **unavailable** coverage; missing an anchor in an inaccessible section is **not** counted as a ranking miss.

## Baselines and optional semantic experiment
- **Weighted lexical ranker:** production keyword-and-heading approach.
- **BM25 ranker:** standard sparse text scoring over the **same chunks and query** as the lexical ranker.
- **Optional embedding reranker:** sends a *bounded candidate set* (at most 20 short chunks plus the question) to the `text-embedding-3-small` embeddings endpoint, then compares cosine similarity. A Vercel-side `FINSIGHT_OPENAI_API_KEY` is required. This **can incur API charges** and is triggered only when the user explicitly opts in before running the benchmark.
- The embedding check is a **candidate reranker**, not full semantic search or a vector DB. A relevant passage omitted from the BM25/uniform candidates is not recoverable. It is unfair to claim the numbers prove full semantic retrieval is better or worse than full-corpus BM25.

### Evaluation interpretation
- Each fixed document has a publicly verified source URL and one manually selected exact phrase identifying a relevant passage.
- Anchors are manually selected from **public SEC disclosures**, but have **not** received independent multi-annotator or blind review. They are not a full human-adjudicated relevance corpus.
- Each result records extracted-byte coverage, whether the anchor was present, its top-three rank (or miss), and any errors.
- Only passages extracted from the same original filing are ranked; no paraphrased fabricated SEC text is substituted.
- No longitudinal benchmark accuracy or significance estimate is possible from three cases.
- The 11 synthetic cases remain the CI regression gate; live SEC requests are **not run in CI** because network access, SEC fair-access policy, large filings, and timing make them unsuitable for every build.

### Recommended next extension
Create a private, human-reviewed holdout of at least 30–50 question/evidence pairs across diverse issuers, section types, reporting years, and unanswerable questions. Record source accession and stable passage offsets. Evaluate extraction coverage separately from ranking (Hit@k, MRR, abstention) and answer factual grounding before choosing vector storage or retrieval model spending.
