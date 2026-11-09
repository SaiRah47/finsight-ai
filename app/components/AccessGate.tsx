'use client';
import {createContext,useCallback,useContext,useEffect,useRef,useState,type FormEvent,type ReactNode} from 'react';
import {browserDb} from '@/lib/supabase/browser';

type Status='checking'|'demo'|'signed-out'|'authorized'|'denied'|'setup'|'exiting';
type AccountState={email:string;signOut:()=>Promise<void>;signingOut:boolean};
const AccountContext=createContext<AccountState|null>(null);

export function AccountMenu(){
 const account=useContext(AccountContext);
 const [open,setOpen]=useState(false);
 const [passwordPanel,setPasswordPanel]=useState(false);
 const [newPassword,setNewPassword]=useState('');
 const [confirmPassword,setConfirmPassword]=useState('');
 const [passwordBusy,setPasswordBusy]=useState(false);
 const [passwordMessage,setPasswordMessage]=useState('');
 const menuRef=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  if(!open)return;
  const outside=(event:PointerEvent)=>{if(menuRef.current&&!menuRef.current.contains(event.target as Node))setOpen(false)};
  const keyboard=(event:KeyboardEvent)=>{if(event.key==='Escape')setOpen(false)};
  document.addEventListener('pointerdown',outside);
  document.addEventListener('keydown',keyboard);
  return ()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',keyboard)};
 },[open]);
 async function savePassword(event:FormEvent){
  event.preventDefault();
  if(passwordBusy)return;
  if(newPassword.length<12){setPasswordMessage('Use at least 12 characters.');return}
  if(newPassword!==confirmPassword){setPasswordMessage('Passwords do not match.');return}
  const db=browserDb();if(!db){setPasswordMessage('Authentication is not connected.');return}
  setPasswordBusy(true);setPasswordMessage('');
  const {error}=await db.auth.updateUser({password:newPassword});
  setPasswordBusy(false);
  if(error){setPasswordMessage(error.message);return}
  setNewPassword('');setConfirmPassword('');
  setPasswordMessage('Password saved. You can now use email and password to sign in.');
 }
 if(!account)return <div className="avatar" aria-label="Demo profile">FS</div>;
 const initials=(account.email.split('@')[0].slice(0,2)||'FS').toUpperCase();
 return <div className="account-control" ref={menuRef}>
   <button className={'account-trigger '+(open?'is-open':'')} aria-label="Open account menu" aria-expanded={open} aria-haspopup="menu" onClick={()=>setOpen(v=>!v)}>
    <span className="avatar" aria-hidden="true">{initials}</span>
    <span className="account-chevron" aria-hidden="true">⌄</span>
   </button>
   {open&&<div className="account-popover" role="menu" aria-label="Account options">
    <div className="account-identity"><span className="account-identity-icon" aria-hidden="true">{initials}</span><div><span className="account-identity-label">Signed in as</span><strong title={account.email}>{account.email}</strong></div></div>
    <div className="account-divider"/>
    {passwordPanel?<form className="account-password-form" onSubmit={savePassword}>
     <label htmlFor="new-account-password">New password (12+ characters)</label>
     <input id="new-account-password" autoComplete="new-password" type="password" minLength={12} required value={newPassword} onChange={e=>setNewPassword(e.target.value)}/>
     <label htmlFor="confirm-account-password">Confirm password</label>
     <input id="confirm-account-password" autoComplete="new-password" type="password" minLength={12} required value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)}/>
     <button className="primary" disabled={passwordBusy}>{passwordBusy?'Saving…':'Save password'}</button>
     {passwordMessage&&<p role="status">{passwordMessage}</p>}
     <button className="account-back" type="button" onClick={()=>{setPasswordPanel(false);setPasswordMessage('');setNewPassword('');setConfirmPassword('')}}>← Back to account</button>
    </form>:<button type="button" role="menuitem" className="account-password-toggle" onClick={()=>{setPasswordPanel(true);setPasswordMessage('')}}>⌁ Set or change password</button>}
    {!passwordPanel&&<button type="button" role="menuitem" className="account-signout" onClick={()=>{setOpen(false);void account.signOut()}} disabled={account.signingOut}>
     <span aria-hidden="true">↗</span>{account.signingOut?'Signing out…':'Sign out'}
    </button>}
   </div>}
  </div>;
}

export default function AccessGate({children}:{children:ReactNode}){
 const [status,setStatus]=useState<Status>('checking');
 const [email,setEmail]=useState(''),[accountEmail,setAccountEmail]=useState('');
 const [message,setMessage]=useState(''),[sending,setSending]=useState(false);
 const [method,setMethod]=useState<'password'|'link'>('password');
 const [password,setPassword]=useState('');
 const exitingRef=useRef(false);
 useEffect(()=>{
  const db=browserDb();
  if(!db){setStatus('demo');return}
  let active=true;
  async function refresh(){
   try{
    const {data:{user}}=await db!.auth.getUser();
    if(!active||exitingRef.current)return;
    if(!user){setStatus('signed-out');return}
    const res=await fetch('/api/auth/status',{cache:'no-store'});
    const data=await res.json();
    if(active&&!exitingRef.current){
     setAccountEmail(user.email||'');
     setStatus(data.authorized?'authorized':data.mode==='setup'?'setup':'denied');
    }
   }catch{if(active&&!exitingRef.current)setStatus('signed-out')}
  }
  void refresh();
  const {data:{subscription}}=db.auth.onAuthStateChange(()=>{setTimeout(()=>{if(active&&!exitingRef.current)void refresh()},0)});
  return ()=>{active=false;subscription.unsubscribe()};
 },[]);
 async function sendLink(e:FormEvent){
  e.preventDefault();const db=browserDb();if(!db)return;
  setSending(true);setMessage('');
  const {error}=await db.auth.signInWithOtp({email:email.trim(),options:{emailRedirectTo:window.location.origin+'/auth/callback',shouldCreateUser:false}});
  setMessage(error?error.message:'Check your inbox for the secure sign-in link.');
  setSending(false);
 }
 async function signInPassword(event:FormEvent){
  event.preventDefault();const db=browserDb();if(!db||sending)return;
  setSending(true);setMessage('');
  const {error}=await db.auth.signInWithPassword({email:email.trim(),password});
  setPassword('');setSending(false);
  if(error)setMessage('Unable to sign in. Check your email and password, or use a magic link if you have not set a password yet.');
 }
 const logout=useCallback(async()=>{
  if(exitingRef.current)return;
  exitingRef.current=true;
  setStatus('exiting');
  // Allow the current workspace to transition out before removing its session.
  await new Promise(resolve=>setTimeout(resolve,360));
  try{await browserDb()?.auth.signOut()}finally{
   setStatus('signed-out');setAccountEmail('');exitingRef.current=false;
  }
 },[]);
 if(status==='demo'||status==='authorized'||status==='exiting'){
  return <AccountContext.Provider value={status==='demo'?null:{email:accountEmail,signOut:logout,signingOut:status==='exiting'}}>
   {status==='demo'&&<div className="demo-mode-notice">DEMO MODE · Supabase not connected · No private information stored</div>}
   <div className={'workspace-transition '+(status==='exiting'?'workspace-leaving':'workspace-entering')}>{children}</div>
   {status==='exiting'&&<div className="auth-transition-overlay" role="status" aria-live="polite"><span className="auth-transition-mark" aria-hidden="true">✦</span><p>Signing you out securely…</p></div>}
  </AccountContext.Provider>;
 }
 return <main className="access-screen"><div className="access-card"><span className="access-emblem">✦</span><div className="eyebrow">FINSIGHT / ATLAS / PRIVATE ACCESS</div><h1>{status==='checking'?'Preparing your workspace.':status==='denied'?'Access restricted.':status==='setup'?'Owner account not configured.':'Intelligence, on your terms.'}</h1><p>{status==='checking'?'Verifying your session.':status==='denied'?'This account is not the designated owner. Sign out and use your authorized account.':status==='setup'?'Add your Supabase user UUID as FINSIGHT_OWNER_USER_ID in Vercel and redeploy.':'Sign in using your existing authorized email to unlock your personal research workspace.'}</p>
 {status==='checking'&&<div className="auth-checking" role="status"><span className="auth-checking-pulse"/>Checking secure access…</div>}
 {status==='signed-out'&&<>
  <div className="login-methods" role="group" aria-label="Sign-in method">
   <button type="button" aria-pressed={method==='password'} className={method==='password'?'selected':''} onClick={()=>{setMethod('password');setMessage('')}}>Password</button>
   <button type="button" aria-pressed={method==='link'} className={method==='link'?'selected':''} onClick={()=>{setMethod('link');setMessage('')}}>Email link</button>
  </div>
  <form onSubmit={method==='password'?signInPassword:sendLink} className="access-form">
   <label htmlFor="owner-email">Email address</label>
   <input id="owner-email" type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/>
   {method==='password'&&<><label htmlFor="owner-password">Password</label><input id="owner-password" type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Your FinSight password"/></>}
   <button className="primary" disabled={sending}>{sending?(method==='password'?'Signing in…':'Sending link…'):(method==='password'?'Sign in securely ↗':'Send sign-in link ↗')}</button>
  </form>
  <p className="access-hint">{method==='password'?'New to password login? Sign in once using Email link, then open your account menu to set a password.':'Magic links are limited by Supabase email quotas. Password sign-in sends no email.'}</p>
 </>}
 <a href="/showcase" style={{display:'block',marginTop:18,padding:'15px 16px',border:'1px solid #8acbc96e',borderRadius:13,background:'linear-gradient(100deg,#80e1cc14,#b2a3ff15)',color:'#d6e8fc',textDecoration:'none',fontWeight:800,fontSize:13,textAlign:'center'}}>✦ Explore FinSight AI Showcase ↗</a>
 <p className="access-hint">Explore a sample-data-only interactive walkthrough without signing in. The private workspace is not accessible through the showcase.</p>
 {(status==='denied'||status==='setup')&&<button className="secondary" onClick={()=>void logout()}>Sign out</button>}
 {message&&<p role="status" className="access-message">{message}</p>}
 <small>Personal workspace · Secure account access · No brokerage connectivity</small></div></main>;
}
