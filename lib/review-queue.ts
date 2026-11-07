/**
 * Candidate questions, NOT answer labels, NOT verified as present in filings.
 * Reviewers use official source documents to label returned passages.
 */
export type ReviewPrompt={id:string;symbol:'NVDA'|'MSFT'|'AAPL';question:string;intent:'research'|'abstention-probe'};
const topics=[
 ['competitive risk factors','What competitive threats are described in the most recent annual filing?'],
 ['cybersecurity','What cybersecurity incident and data protection risks are disclosed?'],
 ['supply chain','What dependencies on external manufacturers or suppliers are disclosed?'],
 ['export controls','What export control or regulatory restrictions affect product availability?'],
 ['AI products','What risks and uncertainties relating to AI products or services are described?'],
 ['revenue growth','What is disclosed about changes in product or service revenue?'],
 ['liquidity','What operating cash flow and liquidity risks are reported?'],
 ['capital expenditures','What is disclosed about capital expenditures and infrastructure investments?'],
 ['litigation','What material legal proceedings or litigation risks appear?'],
 ['customer concentration','What customer concentration or demand risks are discussed?'],
 ['product margins','What gross margin and product mix pressures are reported?']
] as const;
export const REVIEW_PROMPTS:ReviewPrompt[]=(['NVDA','MSFT','AAPL'] as const).flatMap(symbol=>[
 ...topics.map(([topic,question],i)=>({id:symbol+'-'+(i+1),symbol,question,intent:'research' as const})),
 {id:symbol+'-absence',symbol,question:'Does the annual report disclose the chemical composition of a fictional planet called Zythera?',intent:'abstention-probe' as const}
]);
