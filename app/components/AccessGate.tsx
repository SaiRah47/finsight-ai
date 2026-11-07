'use client';
import {useEffect,useState,type FormEvent,type ReactNode} from 'react';
import {browserDb} from '@/lib/supabase/browser';
type Status='checking'|'demo'|'signed-out'|'authorized'|'denied'|'setup';
export default function AccessGate({children}:{children:ReactNode}){
 const [status,setStatus]=useState<Status>('checking'),[email,setEmail]=useState(''),[message,setMessage]=useState(''),[sending,setSending]=useState(false);
 useEffect(()=>{
  const db=browserDb();
  if(!db){setStatus('demo');return}
  let active=true;
  async function refresh(){
   try{
    const {data:{user}}=await db!.auth.getUser();
    if(!active)return;
    if(!user){setStatus('signed-out');return}
    const res=await fetch('/api/auth/status',{cache:'no-store'}),data=await res.json();
    if(active)setStatus(data.authorized?'authorized':data.mode==='setup'?'setup':'denied');
   }catch{if(active)setStatus('signed-out')}
  }
  void refresh();
  const {data:{subscription}}=db.auth.onAuthStateChange(()=>{setTimeout(()=>{if(active)void refresh()},0)});
  return ()=>{active=false;subscription.unsubscribe()};
 },[]);
 async function sendLink(e:FormEvent){
  e.preventDefault();const db=browserDb();if(!db)return;
  setSending(true);setMessage('');
  const {error}=await db.auth.signInWithOtp({email:email.trim(),options:{emailRedirectTo:window.location.origin+'/auth/callback',shouldCreateUser:false}});
  setMessage(error?error.message:'Check your inbox for the secure sign-in link.');
  setSending(false);
 }
 async function logout(){await browserDb()?.auth.signOut();setStatus('signed-out')}
 if(status==='demo'||status==='authorized')return <>{status==='demo'&&<div className="demo-mode-notice">DEMO MODE · Supabase not connected · No private information stored</div>}{children}{status==='authorized'&&<button className="signout-float" onClick={logout}>Sign out</button>}</>;
 return <main className="access-screen"><div className="access-card"><span className="access-emblem">✦</span><div className="eyebrow">FINSIGHT / ATLAS / PRIVATE ACCESS</div><h1>{status==='checking'?'Preparing your workspace.':status==='denied'?'Access restricted.':status==='setup'?'Owner account not configured.':'Intelligence, on your terms.'}</h1><p>{status==='checking'?'Verifying your session.':status==='denied'?'This account is not the designated owner. Sign out and use your authorized account.':status==='setup'?'Add your Supabase user UUID as FINSIGHT_OWNER_USER_ID in Vercel and redeploy.':'Sign in using your existing authorized email to unlock your personal research workspace.'}</p>
 {status==='signed-out'&&<form onSubmit={sendLink} className="access-form"><label htmlFor="owner-email">Email address</label><input id="owner-email" type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/><button className="primary" disabled={sending}>{sending?'Sending link…':'Send sign-in link ↗'}</button></form>}
 {(status==='denied'||status==='setup')&&<button className="secondary" onClick={logout}>Sign out</button>}
 {message&&<p role="status" className="access-message">{message}</p>}
 <small>Personal workspace · Passwordless authentication · No brokerage connectivity</small></div></main>;
}