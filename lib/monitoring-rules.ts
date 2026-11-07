import {evaluateAlert,type AlertRule,type AlertObservation} from './alert-engine.ts';
export type MonitorTransition={emit:boolean;triggered:boolean;eventKey:string|null;observation:string|null;reason:string};
/**
 * Stateful rising-edge detection: a rule must be evaluated as false before a new
 * threshold event can fire. A missing observation NEVER rearms the rule.
 */
export function transitionRule(rule:AlertRule,observation:AlertObservation|null,wasTriggered:boolean):MonitorTransition{
 const result=evaluateAlert(rule,observation);
 if(!rule.enabled||result.value===null)return {emit:false,triggered:wasTriggered,eventKey:null,observation:result.asOf,reason:result.reason};
 const emit=result.triggered&&!wasTriggered;
 return {emit,triggered:result.triggered,eventKey:emit?rule.id+':'+String(result.asOf||'unknown'):null,
  observation:result.asOf,reason:result.reason};
}
/** A previously unseen accession triggers once; first encounter seeds baseline with NO alert. */
export function classifyFilings(accessions:string[],lastSeen:string|null):{newAccessions:string[];nextLastSeen:string|null;seeded:boolean}{
 const clean=[...new Set(accessions.filter(x=>/^\d{10}-\d{2}-\d{6}$/.test(x)))];
 if(!clean.length)return {newAccessions:[],nextLastSeen:lastSeen,seeded:false};
 if(lastSeen===null)return {newAccessions:[],nextLastSeen:clean[0],seeded:true};
 const index=clean.indexOf(lastSeen);
 if(index===0)return {newAccessions:[],nextLastSeen:lastSeen,seeded:false};
 // The old accession falling off the limited window is not proof that all visible filings are new.
 if(index<0)return {newAccessions:[],nextLastSeen:clean[0],seeded:true};
 return {newAccessions:clean.slice(0,index),nextLastSeen:clean[0],seeded:false};
}
