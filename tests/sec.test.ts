import test from 'node:test';
import assert from 'node:assert/strict';
import {parseTickerMap,parseRecentFilings,parseConcept} from '../lib/sec-parser.ts';
const map={0:{ticker:'NVDA',cik_str:1045810,title:'NVIDIA CORPORATION'},1:{ticker:'MSFT',cik_str:789019,title:'MICROSOFT CORP'}};
test('official ticker mapping preserves ten-digit CIK semantics',()=>{
 assert.equal(parseTickerMap(map,'nvda')?.cik_str,1045810);
 assert.equal(parseTickerMap(map,'SPY'),null);
});
const sample={filings:{recent:{
 form:['8-K','10-Q','10-K','4','10-K/A'],
 filingDate:['2026-09-10','2026-08-20','2026-02-25','2026-02-22','bad'],
 reportDate:['','2026-07-31','2026-01-31','',''],
 accessionNumber:['0001045810-26-000111','0001045810-26-000112','0001045810-26-000113','0001045810-26-000114','0001045810-26-000115'],
 primaryDocument:['filing.htm','q.htm','k.htm','x.htm','bad.htm'],
 primaryDocDescription:['Current','Quarterly','Annual','Officer','Bad']
}}};
test('parses only allowlisted forms and safe official document links',()=>{
 const x=parseRecentFilings(sample,1045810);
 assert.equal(x.length,3);
 assert.equal(x[0].url,'https://www.sec.gov/Archives/edgar/data/1045810/000104581026000111/filing.htm');
 assert.equal(x[1].reportDate,'2026-07-31');
});
test('XBRL facts must match recent filed accession and period',()=>{
 const filings=parseRecentFilings(sample,1045810);
 const facts={units:{USD:[
 {accn:'0001045810-26-000112',filed:'2026-08-20',end:'2026-07-31',val:1000,fy:2026},
 {accn:'0001045810-26-000112',filed:'2026-08-20',end:'2026-04-30',val:500,fy:2026},
 {accn:'0000000000-26-000001',filed:'2026-11-01',end:'2026-10-31',val:999999}
 ]}};
 const result=parseConcept(facts,'NetIncomeLoss',filings);
 assert.equal(result?.value,1000);
 assert.equal(result?.url,filings[1].url);
});
test('malformed file names and accession numbers are never used as URLs',()=>{
 const sampleBad={filings:{recent:{form:['10-K'],filingDate:['2026-01-01'],accessionNumber:['0001045810-26-000111'],primaryDocument:['../../evil']}}};
 assert.equal(parseRecentFilings(sampleBad,1045810).length,0);
});
