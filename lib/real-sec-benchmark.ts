import {extractFilingText} from './filing-retrieval.ts';
import {compareRankers,type RankerComparison} from './retrieval-comparison.ts';

/**
 * Fixed SEC documents and a small set of manually selected answer anchors.
 * The anchors were checked against publicly indexed official SEC pages
 * on Nov 7, 2026, but the benchmark has NOT been independently human-adjudicated.
 * Never claim that these represent the full SEC population.
 */
export type RealSECFixture={
 ticker:'NVDA'|'MSFT'|'AAPL';issuer:string;form:'10-K';filed:string;
 accession:string;url:string;question:string;anchor:string;
};
export const REAL_SEC_CASES:readonly RealSECFixture[]=[
 {ticker:'NVDA',issuer:'NVIDIA',form:'10-K',filed:'2026-02-25',
  accession:'0001045810-26-000021',
  url:'https://www.sec.gov/Archives/edgar/data/1045810/000104581026000021/nvda-20260125.htm',
  question:'What does NVIDIA report about export controls on data center chips shipped to China?',
  anchor:'export controls applicable to China are complex'},
 {ticker:'MSFT',issuer:'Microsoft',form:'10-K',filed:'2026-07-29',
  accession:'0001193125-26-323660',
  url:'https://www.sec.gov/Archives/edgar/data/789019/000119312526323660/msft-20260630.htm',
  question:'What risks does Microsoft face from datacenter electricity availability and power supply?',
  anchor:'availability, reliability, and cost of electrical power'},
 {ticker:'AAPL',issuer:'Apple',form:'10-K',filed:'2026-11-03',
  accession:'0000320193-26-000026',
  url:'https://www.sec.gov/Archives/edgar/data/320193/000032019326000026/aapl-20260926.htm',
  question:'What amount of manufacturing purchase obligations did Apple disclose in its annual filing?',
  anchor:'manufacturing purchase obligations of $89.7 billion'}
];
export type RealSECResult={
 ticker:string;sourceUrl:string;accession:string;filed:string;
 question:string;anchor:string;sourceVerified:'official-sec-url';
 charsProcessed:number;truncated:boolean;documentContainsAnchor:boolean;
 comparison:RankerComparison[];
 limitations:string[];
};
export function evaluateRealSECText(item:RealSECFixture,html:string):RealSECResult{
 const document=extractFilingText(html);
 const anchor=document.text.toLowerCase().includes(item.anchor.toLowerCase());
 return {ticker:item.ticker,sourceUrl:item.url,accession:item.accession,filed:item.filed,
  question:item.question,anchor:item.anchor,sourceVerified:'official-sec-url',
  charsProcessed:document.text.length,truncated:document.truncated,documentContainsAnchor:anchor,
  comparison:anchor?compareRankers(document,item.question,item.anchor,3):[],
  limitations:[
   ...(!anchor?['Expected anchor was not present in the bounded extracted text; this is not a ranker failure.']:[]),
   ...(document.truncated?['Only a bounded excerpt of the document was processed. Results cannot be generalized to the whole filing.']:[]),
   'Anchor matching is an exact-string diagnostic, not a semantic relevance judgment or factual entailment check.'
  ]};
}
