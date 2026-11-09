'use client';
import {useState} from 'react';
import Link from 'next/link';
import styles from './showcase.module.css';

type Agent={id:string;name:string;role:string;tag:string;color:string;symbol:string;thesis:string;stance:string;challenge:string;guardrail:string;decision:string};
const agents:Agent[]=[
 {id:'max',name:'AI Maximalist',role:'Growth strategy',tag:'Momentum',color:'#aa98ff',symbol:'NVDA · MSFT · AVGO',
  thesis:'A technology-focused strategy screens a restricted universe for positive historical momentum.',
  stance:'Research analyst: trailing momentum is positive; the candidate meets our rule-based entry condition.',
  challenge:'Skeptic: momentum can reverse abruptly; three correlated technology stocks can amplify drawdowns.',
  guardrail:'Risk guardian: maximum 30% target weight per stock. No borrowing, shorting, or real-money orders.',
  decision:'SIMULATED BUY — only if the dated signal passed. Fill at the next historical open plus modeled slippage.'},
 {id:'skeptic',name:'AI Skeptic',role:'Defensive strategy',tag:'Scheduled',color:'#7dd9c7',symbol:'PG · JNJ · KO',
  thesis:'A defensive universe allocates at scheduled intervals rather than chasing a technology narrative.',
  stance:'Research analyst: the scheduled rebalance evaluates equal-weight defensive exposure.',
  challenge:'Skeptic: defensive sectors can still lose money, and simple rules do not account for valuation.',
  guardrail:'Risk guardian: target allocation is capped; unused virtual capital remains as cash.',
  decision:'SIMULATED REBALANCE — sell first, then buy within available virtual cash only.'},
 {id:'mag7',name:'Mag7 Purist',role:'Concentrated tech',tag:'Trend filter',color:'#f2b68f',symbol:'AAPL · MSFT · AMZN',
  thesis:'A restricted Magnificent Seven subset is assessed with a prior-close moving-average trend filter.',
  stance:'Research analyst: compare the prior close to its trailing 20-session average.',
  challenge:'Skeptic: a trend filter is not a guarantee of excess return and can miss reversals.',
  guardrail:'Risk guardian: enforce capped weights and reject unavailable historical observations.',
  decision:'SIMULATED HOLD OR BUY — based on the previous session, not today’s closing price.'},
 {id:'value',name:'Contrarian Proxy',role:'Price reversion',tag:'Contrarian',color:'#89bfff',symbol:'BRK.B · JPM · CVX',
  thesis:'A contrarian price rule tests entries below a trailing average. It is not a fundamental value model.',
  stance:'Research analyst: evaluate whether the prior close is below the prior 20-session average.',
  challenge:'Skeptic: a falling stock can continue falling; a moving average cannot establish intrinsic value.',
  guardrail:'Risk guardian: zero leverage, realistic next-open modeled fills, constrained position weights.',
  decision:'SIMULATED BUY OR HOLD — deterministic rule tested against the same historical dates as peers.'}
];
const stages=[
 {name:'Research',who:'Market analyst',detail:'Review source provenance, historical observations, technical signals, and timestamp integrity.'},
 {name:'Strategy',who:'Strategy agent',detail:'Propose a dated, rule-based hypothesis from the assigned stock universe.'},
 {name:'Challenge',who:'Counterargument agent',detail:'Question concentration, assumptions, regime sensitivity, and potential false signals.'},
 {name:'Risk check',who:'Risk guardian',detail:'Verify cash sufficiency, portfolio caps, slippage assumptions, and missing data.'},
 {name:'Verdict',who:'Decision council',detail:'Produce a documented BUY, SELL, or HOLD for the virtual ledger only.'}
];
const architecture=[
 {number:'01',name:'Data ingestion',desc:'Twelve Data daily OHLCV and quotes; optional SEC EDGAR filings and fundamentals.'},
 {number:'02',name:'Quality gate',desc:'Timestamp checks, source status, missing-data abstention, historical OHLCV validation.'},
 {number:'03',name:'Agent reasoning',desc:'Strategy-specific research, counterarguments, risk vetoes, and auditable verdicts.'},
 {number:'04',name:'Virtual execution',desc:'Independent $5,000 accounts; whole shares, next-open assumptions, modeled slippage.'},
 {number:'05',name:'Evaluation',desc:'Historical equity curves, drawdown, volatility, Sharpe, and SPY-relative comparisons.'},
 {number:'06',name:'Persistence & observability',desc:'Supabase versioned source snapshots, run history, debates, and traceable decisions.'}
];
const scenarios=[
 {id:'momentum',name:'Momentum rally',label:'Broad momentum',detail:'Illustrative upward-trending market where trend-following entries may receive support.',adjustments:[8.4,3.1,6.2,1.8]},
 {id:'selloff',name:'Sharp selloff',label:'High volatility',detail:'Illustrative risk-off market with higher drawdown pressure and defensive trade-offs.',adjustments:[-12.6,-3.8,-10.9,-6.1]},
 {id:'sideways',name:'Sideways market',label:'Range-bound',detail:'Illustrative sideways regime that challenges trend-following strategies.',adjustments:[-2.3,1.4,-1.2,2.8]}
] as const;
const representative=[{symbol:'NVDA',change:'+7.3%',tone:'up'},{symbol:'PG',change:'+2.1%',tone:'up'},{symbol:'SPY',change:'+4.5%',tone:'up'}];
export default function PublicShowcase(){
 const [selected,setSelected]=useState(0),[stage,setStage]=useState(0),[view,setView]=useState<'workflow'|'architecture'|'scorecard'>('workflow'),[copied,setCopied]=useState(false);
 const [scenario,setScenario]=useState(0),[hasRun,setHasRun]=useState(false);
 const sample=scenarios[scenario];
 const results=agents.map((a,i)=>({name:a.name,value:5000*(1+sample.adjustments[i]/100),change:sample.adjustments[i],color:a.color})).sort((a,b)=>b.value-a.value);
 const selectedResult=results.find(r=>r.name===agents[selected].name)!;
 const active=agents[selected];
 async function share(){
  const url=window.location.origin+'/showcase';
  try{await navigator.clipboard.writeText(url);setCopied(true)}catch{window.prompt('Copy the showcase URL:',url)}
 }
 return <main className={styles.page}>
  <div className={styles.aurora} aria-hidden="true"/>
  <div className={styles.wrap}>
   <header className={styles.header}>
    <Link href="/showcase" className={styles.brand} aria-label="FinSight AI public showcase">
     <span className={styles.mark}>✦</span><span>FinSight <b>AI</b><small>PROJECT SHOWCASE</small></span>
    </Link>
    <div className={styles.headerActions}>
     <span className={styles.privacy}>● PUBLIC TOUR · SAMPLE DATA</span>
     <button className={styles.outlineButton} onClick={()=>void share()}>{copied?'Link copied ✓':'Copy showcase link ↗'}</button>
     <Link href="/" className={styles.ownerLink}>Owner sign-in</Link>
    </div>
   </header>
   <section className={styles.hero}>
    <div className={styles.heroCopy}>
     <div className={styles.eyebrow}><span className={styles.pulse}/> SOFTWARE ENGINEERING / AGENTIC AI / SYSTEM DESIGN</div>
     <h1>Meet the AI agents.<br/><em>Watch them disagree.</em><br/>See what the data says.</h1>
     <p>FinSight AI is an evidence-first market intelligence system and a simulation-only laboratory for competing investment strategies. Explore the architecture, inspect an agent debate, and see how virtual decisions are evaluated—without an account.</p>
     <div className={styles.heroActions}><a href="#experience" className={styles.primaryButton}>Explore interactive demo <span>↘</span></a><a href="#architecture" className={styles.outlineButton}>See how it works</a></div>
     <div className={styles.heroFoot}><span>PRIVATE PRODUCTION WORKSPACE</span><i/> <span>ISOLATED INTERACTIVE SAMPLE</span><i/><span>ZERO REAL TRADING</span></div>
    </div>
    <div className={styles.heroVisual} aria-label="Illustrative multi-agent orchestration visualization">
      <div className={styles.haloOne}/><div className={styles.haloTwo}/>
      <div className={styles.orbitLabel+" "+styles.topOrbit}>RESEARCH AGENT <span>◈</span></div>
      <div className={styles.orbitLabel+" "+styles.leftOrbit}>CRITIC <span>◇</span></div>
      <div className={styles.orbitLabel+" "+styles.rightOrbit}>RISK <span>⬡</span></div>
      <div className={styles.centerLogo}><span>✦</span><b>FinSight</b><small>AGENT ORCHESTRATOR</small></div>
      <div className={styles.orbitFoot}>DEBATE → RISK GATE → VIRTUAL DECISION</div>
    </div>
   </section>
   <div className={styles.statRow}>
    <div><strong>04</strong><span>Strategy experiments</span></div>
    <div><strong>$5K</strong><span>Virtual capital / agent</span></div>
    <div><strong>05</strong><span>Reasoning stages</span></div>
    <div><strong>100%</strong><span>Simulation-only</span></div>
   </div>
   <section id="experience" className={styles.experience}>
    <div className={styles.sectionIntro}><span className={styles.sectionKicker}>01 / THE EXPERIENCE</span><h2>A window into the <em>decision room.</em></h2><p>Choose a hypothetical market scenario, run a sample tournament, then inspect how each strategy responds. Every value is illustrative—not a live model run, historical backtest, or completed trade.</p></div>
    <div className={styles.scenarioPanel}>
      <div><span className={styles.fieldLabel}>TRY THE SANDBOX</span><h3>Choose a market scenario</h3><p>{sample.detail}</p></div>
      <div className={styles.scenarioActions}>
       <div className={styles.scenarioPicker} role="group" aria-label="Sample market scenario">{scenarios.map((s,i)=><button key={s.id} type="button" aria-pressed={scenario===i} className={scenario===i?styles.scenarioActive:''} onClick={()=>{setScenario(i);setHasRun(false);setStage(0)}}>{s.name}</button>)}</div>
       <button type="button" className={styles.primaryButton} onClick={()=>{setHasRun(true);setStage(4)}}>▶ Run sample tournament</button>
      </div>
     </div>
     {hasRun&&<section className={styles.tournamentResult} aria-live="polite" aria-label="Illustrative tournament results">
      <div className={styles.tournamentHeading}><div><span className={styles.fieldLabel}>SANDBOX RESULTS · {sample.label.toUpperCase()}</span><h3>Four strategies. One hypothetical market.</h3></div><span className={styles.samplePill}>ILLUSTRATIVE ONLY</span></div>
      <div className={styles.resultGrid}>{results.map((r,i)=><button type="button" key={r.name} onClick={()=>{setSelected(agents.findIndex(a=>a.name===r.name));setStage(4)}} className={styles.resultCard}><span>#{i+1} · {r.name}</span><strong style={{color:r.color}}>${r.value.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</strong><small>{r.change>=0?'+':''}{r.change.toFixed(1)}% simulated</small></button>)}</div>
      <p>These scenario outcomes are invented educational examples, not predicted returns or results generated by the production engine. Change the scenario to reset the experiment.</p>
     </section>}
     <div className={styles.demoFrame}>
     <div className={styles.demoTopbar}><span><i className={styles.demoLight}/> FINsight / OPERATIONS STUDIO</span><span>PUBLIC SAMPLE · INTERACTIVE</span></div>
     <div className={styles.strategyTabs} role="tablist" aria-label="Choose strategy">{agents.map((a,i)=><button key={a.id} role="tab" aria-selected={selected===i} onClick={()=>{setSelected(i);setStage(0)}} className={selected===i?styles.activeTab:''}><span style={{background:a.color}} className={styles.tabDot}/>{a.name}</button>)}</div>
     <div className={styles.demoBody}>
      <aside className={styles.agentProfile}>
       <span className={styles.fieldLabel}>CURRENT STRATEGY</span>
       <span className={styles.profileSymbol} style={{borderColor:active.color,color:active.color}}>✦</span>
       <h3>{active.name}</h3><span className={styles.tag}>{active.tag} · {active.role}</span>
       <p>{active.thesis}</p>
       <div className={styles.profileDivider}/><span className={styles.fieldLabel}>STRATEGY UNIVERSE</span><strong className={styles.universe}>{active.symbol}</strong>
       <div className={styles.cashBar}><span>{hasRun?'ILLUSTRATIVE ENDING BALANCE':'VIRTUAL STARTING BALANCE'}</span><b>{hasRun?selectedResult.value.toLocaleString('en-US',{style:'currency',currency:'USD'}):'$5,000.00'}</b></div>
      </aside>
      <div className={styles.flowPanel}>
       <div className={styles.flowHeading}><div><span className={styles.fieldLabel}>AGENT WORKFLOW / WALKTHROUGH</span><h3>One decision, five perspectives.</h3></div><span className={styles.fakeLive}>● SAMPLE DATA</span></div>
       <div className={styles.stageList}>{stages.map((s,i)=><button key={s.name} className={stage===i?styles.currentStage:''} onClick={()=>setStage(i)} aria-current={stage===i?'step':undefined}><span>{String(i+1).padStart(2,'0')}</span><b>{s.name}</b><small>{i===stage?'INSPECTING':i<stage?'REVIEWED':'VIEW'}</small></button>)}</div>
       <div className={styles.debateCard}><div className={styles.debateTop}><span className={styles.roleIcon}>{['◈','✦','◇','⬡','✓'][stage]}</span><div><span className={styles.fieldLabel}>{stages[stage].who.toUpperCase()}</span><h4>{stages[stage].name} / {active.name}</h4></div></div>
       <p>{[active.stance,active.stance,active.challenge,active.guardrail,active.decision][stage]}</p><div className={styles.evidenceTag}>◇ Illustrative workflow · Not real-time financial data</div>
       <div className={styles.stageControls}><button onClick={()=>setStage(v=>Math.max(0,v-1))} disabled={stage===0}>← Previous</button><span>STAGE {stage+1} / 5</span><button onClick={()=>setStage(v=>Math.min(4,v+1))} disabled={stage===4}>Next stage →</button></div></div>
      </div>
     </div>
    </div>
   </section>
   <section id="architecture" className={styles.architecture}>
    <div className={styles.sectionIntro}><span className={styles.sectionKicker}>02 / UNDER THE HOOD</span><h2>Built as a system.<br/><em>Not just a chatbot.</em></h2><p>Data provenance, explicit failure handling, independent strategies, simulated execution and auditability are first-class engineering concerns.</p></div>
    <div className={styles.switchRow} role="tablist" aria-label="Project deep dive"><button role="tab" aria-selected={view==='workflow'} className={view==='workflow'?styles.selected:''} onClick={()=>setView('workflow')}>Agent lifecycle</button><button role="tab" aria-selected={view==='architecture'} className={view==='architecture'?styles.selected:''} onClick={()=>setView('architecture')}>Architecture</button><button role="tab" aria-selected={view==='scorecard'} className={view==='scorecard'?styles.selected:''} onClick={()=>setView('scorecard')}>Evaluation philosophy</button></div>
    {view==='workflow'?<div className={styles.lifecycle}>{stages.map((s,i)=><div key={s.name}><span className={styles.stepIndex}>0{i+1}</span><span className={styles.stepGlyph}>{['◈','✦','◇','⬡','✓'][i]}</span><strong>{s.name}</strong><p>{s.detail}</p></div>)}</div>:view==='architecture'?<div className={styles.archGrid}>{architecture.map(x=><article key={x.number}><span>{x.number} / PLATFORM LAYER</span><h3>{x.name}</h3><p>{x.desc}</p></article>)}</div>:<div className={styles.scorePanels}><article><span>FAIR COMPARISONS</span><h3>Same dates. Same capital. Different ideas.</h3><p>Strategies share a matched historical observation window and use identical simulated transaction assumptions. The SPY benchmark is separate from competing agents.</p></article><article><span>MORE THAN RETURNS</span><h3>Risk matters.</h3><p>Compare drawdown, volatility, Sharpe ratio, and benchmark-relative returns—not just which strategy has the biggest ending balance.</p></article><article><span>HONEST EXPERIMENTATION</span><h3>No invented alpha.</h3><p>Data gaps cause abstention. Historical simulations are not forward results, and this public page never claims fictional performance as actual returns.</p></article></div>}
   </section>
   <section className={styles.scoreSection}>
    <div className={styles.scoreVisual}><div className={styles.scoreVisualHeader}><span>HISTORICAL EVALUATION / CONCEPT</span><span className={styles.samplePill}>SAMPLE ONLY</span></div><div className={styles.chartTitle}>What does success look like?</div>
     <div className={styles.fakeChart}>{representative.map((r,i)=><div key={r.symbol} className={styles.fakeBar}><span>{r.symbol}</span><div><i style={{width:[73,38,58][i]+'%',background:['#b09dff','#76d8c7','#92b6ff'][i]}}/></div><small>{r.change}</small></div>)}</div><p>Illustrative values—not real prices, historical backtests, or a FinSight leaderboard.</p>
    </div><div className={styles.scoreCopy}><span className={styles.sectionKicker}>03 / ENGINEERING PRINCIPLES</span><h2>Transparent by design.<br/><em>Tested by construction.</em></h2><p>FinSight separates research evidence from model output, separates historical replay from forward-paper simulation, and keeps owner-only production data behind authentication and database row-level security.</p><div className={styles.featureGrid}><span>✓ Next-session replay fills</span><span>✓ No lookahead signals</span><span>✓ Audit history</span><span>✓ Source freshness checks</span><span>✓ Independent virtual cash</span><span>✓ Risk-based abstention</span></div></div>
   </section>
   <section className={styles.cta}><div><span className={styles.sectionKicker}>THE TAKEAWAY</span><h2>An engineering laboratory for<br/><em>explainable AI decisions.</em></h2><p>Built to explore agent orchestration, backend reliability, structured evidence, and reproducible strategy evaluation. The public tour uses hardcoded illustrative content and does not query owner-only APIs.</p></div><div className={styles.ctaActions}><button onClick={()=>void share()} className={styles.primaryButton}>{copied?'Link copied ✓':'Share this project ↗'}</button><Link className={styles.outlineButton} href="/">Private workspace sign-in</Link></div></section>
   <div className={styles.techStack}><span className={styles.fieldLabel}>BUILT WITH</span><p>Next.js · React · TypeScript · Supabase · PostgreSQL · Vercel · Multi-agent orchestration · SEC EDGAR · Twelve Data</p></div>
   <footer className={styles.footer}><span>✦ FINSIGHT AI <small>PERSONAL SOFTWARE ENGINEERING PROJECT</small></span><span>Public demo data only · No account access · No real-money trading</span><a href="#experience">Back to demo ↑</a></footer>
  </div>
 </main>;
}
