import 'server-only';
/** Single bounded, fail-closed SEC archive downloader; per-instance cooldown complements SEC fair access. */
export type SecDocumentDownload={html:string;bytes:number;complete:boolean;maxBytes:number;durationMs:number};
let blockedUntil=0;
const HOST='www.sec.gov';
export async function downloadSecDocument(url:string,maxBytes=7_500_000):Promise<SecDocumentDownload>{
 const u=new URL(url);
 if(u.protocol!=='https:'||u.hostname!==HOST||u.username||u.password||u.port||
  !/^\/Archives\/edgar\/data\/\d+\/\d{18}\/[A-Za-z0-9_.-]+$/.test(u.pathname)||u.search||u.hash)
  throw Error('Invalid official SEC archive document URL.');
 const agent=process.env.SEC_USER_AGENT?.trim();
 if(!agent||!/.+\s+[^\s@]+@[^\s@]+\.[^\s@]+/.test(agent))
  throw Error('Configure SEC_USER_AGENT with an application name and real contact email in Vercel.');
 if(Date.now()<blockedUntil)throw Error('SEC cooldown active after rate limiting; retry later.');
 const started=Date.now();
 let response:Response;
 try{response=await fetch(url,{headers:{'User-Agent':agent,'Accept':'text/html,text/plain;q=0.9'},next:{revalidate:21600},signal:AbortSignal.timeout(18000)})}
 catch{throw Error('SEC archive request failed or timed out.')}
 if(response.status===429||response.status===403){blockedUntil=Date.now()+60_000;throw Error('SEC restricted automated access (HTTP '+response.status+'); retry later and follow fair-access rules.')}
 if(!response.ok)throw Error('SEC archive returned HTTP '+response.status);
 const contentType=response.headers.get('content-type')||'';
 if(contentType&&!/html|text|octet-stream/i.test(contentType))throw Error('SEC returned a document format unsupported by text extraction.');
 const reader=response.body?.getReader();
 if(!reader)throw Error('SEC returned an empty document response.');
 let bytes=0,complete=false,html='';
 const decoder=new TextDecoder();
 try{
  while(bytes<maxBytes){
   const {done,value}=await reader.read();
   if(done){complete=true;break}
   const available=Math.min(value.byteLength,maxBytes-bytes);
   bytes+=available;
   html+=decoder.decode(value.subarray(0,available),{stream:true});
   if(available<value.byteLength)break;
  }
  // The cap may have been reached exactly at EOF; conservatively mark as partial.
  html+=decoder.decode();
 }finally{await reader.cancel().catch(()=>{})}
 return {html,bytes,complete,maxBytes,durationMs:Date.now()-started};
}
