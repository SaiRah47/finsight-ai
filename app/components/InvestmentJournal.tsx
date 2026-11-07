'use client';
import {useEffect,useState} from 'react';
type Entry={id:string;symbol:string|null;title:string;thesis:string;status:'researching'|'watching'|'invalidated'|'archived';evidence_url:string|null;created_at:string};
type Status=Entry['status'];
export default function InvestmentJournal(){
 const [entries,setEntries]=useState<Entry[]>([]),[title,setTitle]=useState(''),[symbol,setSymbol]=useState(''),[thesis,setThesis]=useState(''),[url,setUrl]=useState('');
 const [status,setStatus]=useState<Status>('researching'),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function load(){setBusy(true);setError('');try{const r=await fetch('/api/journal',{cache:'no-store'}),body=await r.json();if(!r.ok)throw Error(body.error||'Journal unavailable');setEntries(body.entries||[])}catch(e){setError(e instanceof Error?e.message:'Unable to load notes')}finally{setBusy(false)}}
 useEffect(()=>{void load()},[]);
 async function save(){
  setBusy(true);setError('');
  try{const r=await fetch('/api/journal',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({symbol:symbol.trim()?symbol.trim().toUpperCase():null,title,thesis,status,evidence_url:url.trim()||null})}),body=await r.json();
   if(!r.ok)throw Error(body.error||'Unable to save note');setTitle('');setSymbol('');setThesis('');setUrl('');await load()}
  catch(e){setError(e instanceof Error?e.message:'Save failed')}finally{setBusy(false)}
 }
 async function modify(id:string,status:Status){setBusy(true);try{const r=await fetch('/api/journal',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,status})});if(!r.ok)throw Error('Update failed');await load()}catch(e){setError(e instanceof Error?e.message:'Update failed')}finally{setBusy(false)}}
 async function remove(id:string){setBusy(true);try{const r=await fetch('/api/journal?id='+encodeURIComponent(id),{method:'DELETE'});if(!r.ok)throw Error('Delete failed');await load()}catch(e){setError(e instanceof Error?e.message:'Delete failed')}finally{setBusy(false)}}
 return <section className="atlas-phase6">
  <div className="atlas-phase6-heading"><div><div className="eyebrow">INVESTMENT RESEARCH JOURNAL / PRIVATE</div><h2>Document the <span className="gradient">investment thesis.</span></h2><p>Capture assumptions, counterarguments, primary evidence and how your thesis changes. These notes are not trade instructions.</p></div><button className="secondary" onClick={()=>void load()} disabled={busy}>Refresh notes ↻</button></div>
  {error&&<p className="market-alert" role="alert">{error}</p>}
  <div className="atlas-phase6-panel"><h3>New research note</h3><div className="atlas-phase6-fields">
   <label>Title<input maxLength={160} placeholder="NVIDIA supply constraints" value={title} onChange={e=>setTitle(e.target.value)}/></label>
   <label>Symbol (optional)<input maxLength={12} value={symbol} onChange={e=>setSymbol(e.target.value)} placeholder="NVDA"/></label>
   <label>Status<select value={status} onChange={e=>setStatus(e.target.value as Status)}>{(['researching','watching','invalidated','archived'] as const).map(x=><option key={x} value={x}>{x}</option>)}</select></label>
   <label>Source URL (optional)<input value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://www.sec.gov/..."/></label>
   <label className="atlas-wide-field">Evidence, thesis and uncertainties<textarea rows={5} maxLength={4000} value={thesis} onChange={e=>setThesis(e.target.value)} placeholder="Thesis, supporting evidence, counterpoints, conditions that would invalidate it..."/></label>
   <button className="primary" disabled={busy||title.trim().length<3||!thesis.trim()} onClick={()=>void save()}>Save research note</button></div></div>
  <div className="atlas-phase6-panel"><h3>Research history · {entries.length} entries</h3>
   {!entries.length&&<p className="muted">Your journal is empty. Add a hypothesis to start an evidence trail.</p>}
   <div className="atlas-journal-list">{entries.map(e=><article key={e.id}>
    <div className="atlas-journal-title"><strong>{e.title}</strong><span>{e.symbol||'General'} · {new Date(e.created_at).toLocaleDateString()}</span></div>
    <p>{e.thesis}</p>{e.evidence_url&&/^https:\/\//.test(e.evidence_url)&&<a href={e.evidence_url} rel="noreferrer" target="_blank">Open source evidence ↗</a>}
    <div className="atlas-journal-actions"><label>Status<select disabled={busy} value={e.status} onChange={event=>void modify(e.id,event.target.value as Status)}>{(['researching','watching','invalidated','archived'] as const).map(x=><option key={x} value={x}>{x}</option>)}</select></label><button className="pill" disabled={busy} onClick={()=>void remove(e.id)}>Delete note</button></div>
   </article>)}</div>
  </div></section>;
}
