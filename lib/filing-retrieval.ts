/**
 * Deterministic, dependency-free SEC document passage extraction and ranking.
 * No web access or secrets; functions are pure and tested with synthetic fixtures.
 */
export type FilingPassage={
 id:string;section:string;text:string;start:number;end:number;
 score:number;matchedTerms:string[];
};
export type FilingDocument={text:string;sections:{heading:string;start:number;end:number}[];truncated:boolean};
const CAP=280_000;
const MAX_CHUNKS=240;
function decodeEntities(raw:string):string{
 return raw.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp|ndash|mdash|rsquo|lsquo);/gi,(value,body:string)=>{
  const names:Record<string,string>={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',ndash:'–',mdash:'—',rsquo:"'",lsquo:"'"};
  if(body[0]==='#'){
   const parsed=body[1]?.toLowerCase()==='x'?parseInt(body.slice(2),16):parseInt(body.slice(1),10);
   return Number.isFinite(parsed)&&parsed>0&&parsed<=0x10ffff&&!(parsed>=0xd800&&parsed<=0xdfff)?String.fromCodePoint(parsed):' ';
  }
  return names[body.toLowerCase()]??value;
 });
}
export function extractFilingText(html:string):FilingDocument{
 // Reject highly malformed/untrusted wrappers, scripts, and EDGAR inline XBRL noise.
 const cleaned=html.slice(0,3_500_000)
  .replace(/<!--[\s\S]*?-->/g,' ')
  .replace(/<(script|style|head|noscript|svg|xml|ix:header|ix:resources|ix:hidden)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,' ')
  .replace(/<br\s*\/?\s*>/gi,'\n')
  .replace(/<\/(p|div|tr|h[1-6]|table|li|section)\s*>/gi,'\n')
  .replace(/<[^>]+>/g,' ');
 const text=decodeEntities(cleaned).replace(/\r/g,'')
  .replace(/[ \t]+/g,' ').replace(/[ \t]*\n[ \t]*/g,'\n')
  .replace(/\n{3,}/g,'\n\n').trim().slice(0,CAP);
 const sections:{heading:string;start:number;end:number}[]=[];
 const regex=/(?:^|\n)\s*(ITEM\s+(?:1A|1B|1C|2|3|7A?|8|9A|9B|10|11|12|13|14|15)\s*[.:-]?\s*[^\n]{0,105})/gim;
 let hit:RegExpExecArray|null;
 while((hit=regex.exec(text))&&sections.length<100){
  const heading=hit[1].trim().slice(0,112),start=hit.index+hit[0].indexOf(hit[1]);
  if(text.slice(start,start+500).length===0)continue;
  if(sections.length&&start-sections[sections.length-1].start<100)continue;
  sections.push({heading,start,end:text.length});
 }
 for(let i=0;i<sections.length-1;i++)sections[i].end=sections[i+1].start;
 return {text,sections,truncated:html.length>3_500_000||cleaned.length>CAP};
}
const ignored=new Set(['the','and','for','are','what','why','has','have','was','with','which','how','about','from','this','that','their','please','show','find','latest','company','nvidia','apple','microsoft','amazon','report','filing','filings','sec','stock','shares','what','recent','its','they']);
export function queryTerms(query:string):string[]{
 const tokens=(query.toLowerCase().match(/[a-z][a-z0-9-]{2,}/g)||[])
  .filter(x=>!ignored.has(x));
 const concepts:Record<string,string[]>={risk:['risk','uncertainty','competition','adverse','cybersecurity'],volatility:['volatility','fluctuation','market','risk'],revenue:['revenue','sales','income','growth'],ai:['artificial','intelligence','computing'],margin:['margin','profit','cost'],liquidity:['liquidity','cash','debt'],earnings:['income','results','performance'],competition:['competition','competitive']};
 const all=[...tokens,...tokens.flatMap(x=>concepts[x]||[])];
 if(/risk|volatil|uncertain/i.test(query))all.push('risk');
 if(/item\s*1a/i.test(query))all.push('item','1a');
 return [...new Set(all)].slice(0,25);
}
function headingAt(start:number,doc:FilingDocument):string{
 let heading='Unlabeled passage';
 for(const section of doc.sections){if(section.start>start)break;heading=section.heading}
 return heading;
}
function makeChunks(doc:FilingDocument):FilingPassage[]{
 // Use small overlapping windows instead of full-document context or remote vector storage.
 const result:FilingPassage[]=[];const span=1100,overlap=180;
 let start=0;
 while(start<doc.text.length&&result.length<MAX_CHUNKS){
  let end=Math.min(start+span,doc.text.length);
  if(end<doc.text.length){
   const breakAt=Math.max(doc.text.lastIndexOf('\n',end),doc.text.lastIndexOf('. ',end));
   if(breakAt>start+650)end=breakAt+1;
  }
  const raw=doc.text.slice(start,end).trim();
  if(raw.length>100)result.push({id:'P'+(result.length+1),section:headingAt(start,doc),text:raw,start,end,score:0,matchedTerms:[]});
  if(end===doc.text.length)break;
  start=Math.max(start+1,end-overlap);
 }
 return result;
}
export function retrievePassages(doc:FilingDocument,question:string,limit=4):FilingPassage[]{
 const terms=queryTerms(question);
 const chunks=makeChunks(doc);
 if(!terms.length||!chunks.length)return [];
 const byTerm=new Map<string,number>();
 for(const term of terms)byTerm.set(term,chunks.filter(chunk=>chunk.text.toLowerCase().includes(term)).length);
 const scored=chunks.map(chunk=>{
  const lower=chunk.text.toLowerCase(),heading=chunk.section.toLowerCase(),matched:string[]=[];
  let score=0;
  for(const term of terms){
   const word=new RegExp('(^|[^a-z0-9])'+term.replace(/[.*+?^$\{\}()|[\]\\]/g,'\\$&')+'(?=$|[^a-z0-9])','g');
   const hits=[...lower.matchAll(word)].length;
   if(!hits)continue;
   matched.push(term);
   const idf=Math.log(1+(chunks.length+1)/(1+(byTerm.get(term)||0)));
   score+=idf*(1+Math.log1p(Math.min(hits,12)));
   if(heading.includes(term))score+=2.5;
  }
  if(/risk|uncertain/i.test(question)&&/item\s+1a/i.test(heading))score+=4;
  return {...chunk,score:Number(score.toFixed(3)),matchedTerms:matched};
 }).filter(chunk=>chunk.score>0);
 scored.sort((a,b)=>b.score-a.score||a.start-b.start);
 const output:FilingPassage[]=[];
 for(const chunk of scored){
  if(output.some(chosen=>Math.min(chosen.end,chunk.end)-Math.max(chosen.start,chunk.start)>200))continue;
  output.push(chunk);
  if(output.length>=Math.max(1,Math.min(limit,6)))break;
 }
 return output;
}
