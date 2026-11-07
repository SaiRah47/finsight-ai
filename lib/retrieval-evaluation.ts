import {extractFilingText,retrievePassages} from './filing-retrieval.ts';

export type LabeledRetrievalCase={
 id:string;question:string;documentHtml:string;expectedText:string|null;
};
export type RetrievalCaseResult={
 id:string;expectedAnswer:boolean;retrieved:number;relevantRanks:number[];
 hitAt1:boolean;hitAt3:boolean;reciprocalRank:number;falsePositive:boolean;
};
export type RetrievalEvaluation={
 cases:number;answerable:number;unanswerable:number;
 hitAt1:number;recallAt3:number;mrr:number;falsePositiveRate:number;
 results:RetrievalCaseResult[];
};
const round=(n:number)=>Number(n.toFixed(3));
/**
 * Evaluates retrieval position against a human-labelled evidence substring.
 * An answerable case succeeds only when the retrieved passage itself includes
 * the entire expected string, not merely a related heading or term.
 * False-positive rate is measured on explicitly unanswerable cases.
 */
export function evaluateRetrieval(cases:LabeledRetrievalCase[]):RetrievalEvaluation{
 const results=cases.map(item=>{
  const doc=extractFilingText(item.documentHtml);
  const hits=retrievePassages(doc,item.question,3);
  const ranks=item.expectedText===null?[]:hits.flatMap((p,i)=>p.text.toLowerCase().includes(item.expectedText!.toLowerCase())?[i+1]:[]);
  return {id:item.id,expectedAnswer:item.expectedText!==null,retrieved:hits.length,
   relevantRanks:ranks,hitAt1:ranks.includes(1),hitAt3:ranks.length>0,
   reciprocalRank:ranks.length?1/ranks[0]:0,falsePositive:item.expectedText===null&&hits.length>0};
 });
 const answerable=results.filter(x=>x.expectedAnswer),unanswerable=results.filter(x=>!x.expectedAnswer);
 const mean=(values:number[])=>values.length?values.reduce((sum,x)=>sum+x,0)/values.length:0;
 return {cases:results.length,answerable:answerable.length,unanswerable:unanswerable.length,
  hitAt1:round(mean(answerable.map(x=>Number(x.hitAt1)))),
  recallAt3:round(mean(answerable.map(x=>Number(x.hitAt3)))),
  mrr:round(mean(answerable.map(x=>x.reciprocalRank))),
  falsePositiveRate:round(mean(unanswerable.map(x=>Number(x.falsePositive)))),results};
}
