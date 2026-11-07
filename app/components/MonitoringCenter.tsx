'use client';
import {useEffect,useState} from 'react';
type Settings={enabled:boolean;email_enabled:boolean;filings_enabled:boolean};
type MonitorRun={id:string;run_day:string;status:string;symbols_scanned:number;events_created:number;error_text:string|null;started_at:string};
type MonitorEvent={id:string;kind:'filing'|'threshold';symbol:string;title:string;details:string;observation_at:string|null;source_url:string|null;created_at:string;read_at:string|null;email_status:string};
type Snapshot={settings:Settings;runs:MonitorRun[];events:MonitorEvent[];unread:number;configuration:{schedulerReady:boolean;emailProviderReady:boolean};disclaimer:string};
export default function MonitoringCenter(){
 const [data,setData]=useState<Snapshot|null>(null),[draft,setDraft]=useState<Settings>({enabled:false,email_enabled:false,filings_enabled:true});
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 async function load(){
  setBusy(true);setError('');
  try{
   const r=await fetch('/api/monitor',{cache:'no-store'});const json=await r.json();
   if(!r.ok)throw Error(json.error||'Monitoring unavailable');
   setData(json);setDraft(json.settings);
  }catch(e){setError(e instanceof Error?e.message:'Monitoring unavailable')}
  finally{setBusy(false)}
 }
 useEffect(()=>{void load()},[]);
 async function save(){
  setBusy(true);setError('');setMessage('');
  try{
   const r=await fetch('/api/monitor',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(draft)});
   const json=await r.json();if(!r.ok)throw Error(json.error||'Could not save monitoring preferences');
   setMessage(draft.enabled?'Monitoring preferences saved. Next checks require the scheduled cron to run.':'Scheduled monitoring disabled.');
   await load();
  }catch(e){setError(e instanceof Error?e.message:'Unable to save preferences')}
  finally{setBusy(false)}
 }
 async function runNow(){
  setBusy(true);setError('');setMessage('');
  try{
   const r=await fetch('/api/monitor/run',{method:'POST'}),payload=await r.json();
   if(!r.ok)throw Error(payload.error||'Scheduled scan unavailable');
   setMessage(payload.status==='duplicate'?'This UTC day has already been scanned. The next scan is scheduled for the following day.':
    payload.status==='disabled'?'Enable monitoring before running the daily scan.':
    'Daily scan '+payload.status+': '+payload.symbols+' rule tickers checked, '+payload.created+' new events.');
   await load();
  }catch(e){setError(e instanceof Error?e.message:'Scan unavailable')}
  finally{setBusy(false)}
 }
 async function markRead(id:string,read:boolean){
  try{
   const r=await fetch('/api/monitor',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,read})});
   if(!r.ok)throw Error('Event update failed');
   await load();
  }catch(e){setError(e instanceof Error?e.message:'Event update failed')}
 }
 const safeSec=(url:string|null)=>{if(!url)return false;try{const u=new URL(url);return u.protocol==='https:'&&u.hostname==='www.sec.gov'&&u.pathname.startsWith('/Archives/edgar/data/')}catch{return false}};
 return <section className="monitor-center">
  <div className="atlas-phase6-heading"><div><div className="eyebrow">PHASE 7 / PRIVATE AUTOMATED RESEARCH</div><h2>Monitoring <span className="gradient">command center.</span></h2>
  <p>One controlled daily scan of selected watchlist rules and SEC filings, with deduplicated event history and optional email. Everything is disabled until you opt in.</p></div>
   <button className="secondary" disabled={busy} onClick={()=>void load()}>{busy?'Refreshing…':'Refresh monitoring ↻'}</button></div>
  {error&&<div className="market-alert" role="alert">{error}</div>}
  {message&&<p className="monitor-success" role="status">{message}</p>}
  <div className="monitor-grid">
   <div className="atlas-phase6-panel"><h3>Monitoring preferences</h3>
    <div className="monitor-toggle"><label><input type="checkbox" checked={draft.enabled} onChange={e=>setDraft(p=>({...p,enabled:e.target.checked,email_enabled:e.target.checked?p.email_enabled:false}))}/> Enable daily scheduled scan</label><small>Disabled by default. Checks up to 3 rule tickers and 2 watchlist SEC issuers.</small></div>
    <div className="monitor-toggle"><label><input type="checkbox" checked={draft.filings_enabled} onChange={e=>setDraft(p=>({...p,filings_enabled:e.target.checked}))}/> Include SEC filing change detection</label><small>First scan sets a baseline; existing filings do not generate historical alerts.</small></div>
    <div className="monitor-toggle"><label><input type="checkbox" checked={draft.email_enabled} disabled={!draft.enabled||!data?.configuration.emailProviderReady} onChange={e=>setDraft(p=>({...p,email_enabled:e.target.checked}))}/> Send email for new alerts (optional)</label><small>{data?.configuration.emailProviderReady?'Email provider appears configured. Email only when enabled.':'Configure Resend and email addresses in Vercel first.'}</small></div>
    <button className="primary" disabled={busy||!data} onClick={()=>void save()}>Save monitoring preferences</button>
    <button className="secondary" style={{marginTop:10}} disabled={busy||!data?.settings.enabled} onClick={()=>void runNow()}>Run today's scan now ↗</button>
    <p className="atlas-hint">{data?.configuration.schedulerReady?'Scheduler secrets appear configured.':'Scheduled execution is not configured: add CRON_SECRET and SUPABASE_SECRET_KEY in Vercel.'} Vercel Hobby scheduling is approximate and not intended for minute-level or intraday alerts.</p>
   </div>
   <div className="atlas-phase6-panel"><h3>Monitoring snapshot</h3><div className="monitor-kpis">
    <div><small>Status</small><strong>{data?.settings.enabled?'Enabled':'Off'}</strong></div>
    <div><small>Unread events</small><strong>{data?.unread??'—'}</strong></div>
    <div><small>Saved runs</small><strong>{data?.runs.length??'—'}</strong></div>
    <div><small>Last check</small><strong>{data?.runs[0]?.run_day||'Never'}</strong></div>
   </div>
   <p className="atlas-hint">Events are informational. Stale quotes, failed SEC fetches and provider limits can prevent or delay checks; alerts are not trading instructions.</p></div>
  </div>
  <div className="atlas-phase6-panel"><div className="sectiontitle"><h3>Notification inbox</h3><span className="pill">{data?.unread??0} unread</span></div>
   {!data?.events.length&&<p className="muted">No monitoring events yet. Once enabled, the scheduled task records new threshold crossings or newly observed SEC accessions.</p>}
   <div className="monitor-event-list">{data?.events.map(ev=><article className={'monitor-event '+(!ev.read_at?'monitor-unread':'')} key={ev.id}>
    <div className="monitor-event-title"><strong>{ev.kind==='filing'?'▤':'⌁'} {ev.title}</strong><span>{new Date(ev.created_at).toLocaleString()}</span></div>
    <p>{ev.details}</p><div className="monitor-event-footer"><span>{ev.symbol} · observed {ev.observation_at||'Date unknown'} · email {ev.email_status}</span>
    {safeSec(ev.source_url)&&<a href={ev.source_url!} target="_blank" rel="noreferrer">Open SEC source ↗</a>}
    <button className="pill" onClick={()=>void markRead(ev.id,!ev.read_at)} disabled={busy}>{ev.read_at?'Mark unread':'Mark read'}</button></div>
   </article>)}</div>
  </div>
  <div className="atlas-phase6-panel"><h3>Scheduled run history</h3>
   {!data?.runs.length&&<p className="muted">No scheduled runs have been recorded.</p>}
   <div className="monitor-run-list">{data?.runs.map(run=><div className="monitor-run" key={run.id}><strong>{run.run_day}</strong><span>{run.status}</span><span>{run.symbols_scanned} symbols</span><span>{run.events_created} events</span>{run.error_text&&<small title={run.error_text}>Provider/data limitations recorded</small>}</div>)}</div>
  </div>
  <p className="atlas-disclaimer">{data?.disclaimer||'Monitoring requires an owner-authenticated Supabase migration, Vercel secrets and explicit opt-in.'} This is a daily polling prototype, not autonomous trading or guaranteed real-time market surveillance.</p>
 </section>;
}
