import {writeFileSync} from 'node:fs';
import {evaluateRetrieval} from '../lib/retrieval-evaluation.ts';
import {SEC_RETRIEVAL_CASES} from '../tests/fixtures/sec-retrieval-cases.ts';

const result=evaluateRetrieval(SEC_RETRIEVAL_CASES);
const report={
 dataset:'Synthetic SEC-style fixtures (NOT real SEC filings)',
 recordedAt:new Date().toISOString(),
 implementation:'bounded-text-keyword-v2',
 metrics:{
  cases:result.cases,answerable:result.answerable,unanswerable:result.unanswerable,
  hitAt1:result.hitAt1,recallAt3:result.recallAt3,
  meanReciprocalRank:result.mrr,falsePositiveRate:result.falsePositiveRate
 },
 limitations:[
  'Hand-authored synthetic fixtures only; do not infer production SEC relevance from this score.',
  'Evidence labels are exact text substrings, not judgments of semantic relevance.',
  'No real SEC downloads or user information are accessed.',
  'A returned citation is not proof of factual entailment in a generated answer.'
 ],
 perCase:result.results
};
writeFileSync('retrieval-eval-report.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report.metrics,null,2));
const failures=result.results.filter(r=>r.expectedAnswer&&!r.hitAt3).map(r=>r.id);
if(failures.length)console.log('Top-3 misses:',failures.join(', '));
if(result.recallAt3<0.75||result.hitAt1<0.625||result.falsePositiveRate>0.34){
 console.error('Synthetic retrieval quality gate failed.');
 process.exitCode=1;
}
