'use client';
import {useEffect,useState} from 'react';
type Hub={
 portfolio:{positions:number;symbols:string[]};
 rules:{count:number;enabled:number};
 watchlist:{count:number};
 journal:{countRecent:number;latest:{id:string;title:string;symbol:string|null;status:string;created_at:string}[]};
 research:{latest:{id:string;question:string;route:string;created_at:string}[]};
 note:string;asOf:string;
};
export default function IntelligenceHub({onNavigate}:{onNavigate:(view:'Portfolio'|'Alerts'|'Journal'|'Quality lab'|'Execution studio')=>void}){
 const [data,setData]=useState<Hub|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function refresh(){
  setBusy(true);setError('');
  try{const r=await fetch('/api/intelligence/summary',{cache:'no-store'}),result=await r.json();if(!r.ok)throw Error(result.error||'Intelligence unavailable');setData(result)}
  catch(e){setError(e instanceof Error?e.message:'Unable to load private intelligence')}finally{setBusy(false)}
 }
 useEffect(()=>{void refresh()},[]);
 return <section className="atlas-hub">
  <div className="sectiontitle"><h2>Private intelligence center</h2><button className="pill" disabled={busy} onClick={()=>void refresh()}>{busy?'Loading…':'Refresh ↻'}</button></div>
  {error&&<p className="market-alert" role="alert">{error}</p>}
  <p className="atlas-hint">Saved holdings, watchlist rules, research notes, and recent research in one place. Values shown below come from Supabase; no provider calls are made until you open a relevant tool.</p>
  <div className="atlas-hub-grid">
   <button onClick={()=>onNavigate('Portfolio')}><small>Manually entered holdings</small><strong>{data?data.portfolio.positions:'—'}</strong><span>Open portfolio ↗</span></button>
   <button onClick={()=>onNavigate('Alerts')}><small>Enabled watchlist rules</small><strong>{data?data.rules.enabled:'—'}</strong><span>Check rules on demand ↗</span></button>
   <button onClick={()=>onNavigate('Journal')}><small>Recent journal entries</small><strong>{data?data.journal.countRecent:'—'}</strong><span>Open research journal ↗</span></button>
   <button onClick={()=>onNavigate('Execution studio')}><small>Recent research runs</small><strong>{data?data.research.latest.length:'—'}</strong><span>View saved traces ↗</span></button>
  </div>
  {data&&<div className="atlas-hub-activity">
   <div><h3>Latest research notes</h3>{data.journal.latest.length?data.journal.latest.slice(0,3).map(x=><button key={x.id} onClick={()=>onNavigate('Journal')}><strong>{x.title}</strong><small>{x.symbol||'General'} · {x.status}</small></button>):<p>No research notes yet.</p>}</div>
   <div><h3>Latest agent research</h3>{data.research.latest.length?data.research.latest.slice(0,3).map(x=><button key={x.id} onClick={()=>onNavigate('Execution studio')}><strong>{x.question}</strong><small>{x.route} · {new Date(x.created_at).toLocaleDateString()}</small></button>):<p>No saved agent runs yet.</p>}</div>
  </div>}
 </section>;
}
