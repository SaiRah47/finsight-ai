import type {SecFiling,SecFact} from './sec-types';
const forms=new Set(['10-K','10-Q','8-K','10-K/A','10-Q/A','8-K/A']);
const safeFile=(value:string)=>/^[A-Za-z0-9_.-]+$/.test(value)&&!value.includes('..');
const safeAccession=(value:string)=>/^\d{10}-\d{2}-\d{6}$/.test(value);
const isDate=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value);
const safeCIK=(value:number)=>Number.isSafeInteger(value)&&value>0;
type CompanyTicker={cik_str:number;ticker:string;title:string};
type Recent={form?:unknown;filingDate?:unknown;reportDate?:unknown;accessionNumber?:unknown;primaryDocument?:unknown;primaryDocDescription?:unknown};
export function parseTickerMap(input:unknown,symbol:string):CompanyTicker|null{
 if(!input||typeof input!=='object'||Array.isArray(input))return null;
 const target=symbol.toUpperCase();
 const item=Object.values(input as Record<string,unknown>).find((row)=>{
  if(!row||typeof row!=='object'||Array.isArray(row))return false;
  const record=row as Record<string,unknown>;
  return String(record.ticker||'').toUpperCase()===target&&safeCIK(Number(record.cik_str));
 });
 if(!item)return null;
 const record=item as Record<string,unknown>;
 return {cik_str:Number(record.cik_str),ticker:String(record.ticker),title:String(record.title||symbol)};
}
export function parseRecentFilings(input:unknown,cik:number,limit=12):SecFiling[]{
 if(!input||typeof input!=='object')return [];
 const record=input as Record<string,unknown>;
 const recent=(record.filings as Record<string,unknown>|undefined)?.recent as Record<string,unknown>|undefined;
 if(!recent)return [];
 const columns=['form','filingDate','reportDate','accessionNumber','primaryDocument','primaryDocDescription'] as const;
 const values=Object.fromEntries(columns.map(k=>[k,Array.isArray(recent[k])?recent[k] as unknown[]:[]])) as Record<keyof Recent,unknown[]>;
 const count=Math.min(values.form.length,values.filingDate.length,values.accessionNumber.length,values.primaryDocument.length,2000);
 const output:SecFiling[]=[];
 for(let i=0;i<count&&output.length<limit;i++){
  const form=String(values.form[i]??''),filed=String(values.filingDate[i]??'');
  const accession=String(values.accessionNumber[i]??''),primary=String(values.primaryDocument[i]??'');
  if(!forms.has(form)||!isDate(filed)||!safeAccession(accession)||!safeFile(primary))continue;
  const reportDate=String(values.reportDate[i]??'');
  const url=`${'https://www.sec.gov'}/Archives/edgar/data/${cik}/${accession.replaceAll('-','')}/${primary}`;
  output.push({id:accession,form,filed,reportDate:isDate(reportDate)?reportDate:null,accession,url,primaryDocument:primary,description:String(values.primaryDocDescription[i]??form).slice(0,160)});
 }
 return output;
}
export function parseConcept(input:unknown,tag:string,filings:SecFiling[]):SecFact|null{
 if(!input||typeof input!=='object')return null;
 const root=input as Record<string,unknown>;
 const units=root.units;
 if(!units||typeof units!=='object'||Array.isArray(units))return null;
 const usd=(units as Record<string,unknown>).USD;
 if(!Array.isArray(usd))return null;
 const accessions=new Map(filings.filter(f=>f.form==='10-K'||f.form==='10-Q').map(f=>[f.accession,f]));
 const candidates=usd.flatMap(item=>{
  if(!item||typeof item!=='object'||Array.isArray(item))return [];
  const r=item as Record<string,unknown>;
  const accession=String(r.accn||'');
  const filed=String(r.filed||''),end=String(r.end||'');
  const val=Number(r.val);
  const filing=accessions.get(accession);
  if(!filing||!Number.isFinite(val)||!isDate(filed)||!isDate(end))return [];
  // Prefer a fact whose SEC report period agrees with the selected filing.
  if(filing.reportDate&&filing.reportDate!==end)return [];
  return [{accession,filed,end,value:val,form:filing.form,url:filing.url,fy:Number.isFinite(Number(r.fy))?Number(r.fy):null,frame:typeof r.frame==='string'?r.frame:null}];
 });
 candidates.sort((a,b)=>b.filed.localeCompare(a.filed)||b.end.localeCompare(a.end)||(b.frame?1:0)-(a.frame?1:0));
 const best=candidates[0];
 if(!best)return null;
 const labels:Record<string,string>={Revenues:'Revenue',RevenueFromContractWithCustomerExcludingAssessedTax:'Revenue',NetIncomeLoss:'Net income'};
 return {id:tag,label:labels[tag]||tag,value:best.value,unit:'USD',end:best.end,filed:best.filed,form:best.form,accession:best.accession,url:best.url,fiscalYear:best.fy};
}
