/** Deterministic on-demand alert evaluation. Does not deliver notifications. */
export type AlertMetric='price_above'|'price_below'|'daily_change_abs'|'volatility_above'|'volume_ratio_above';
export type AlertRule={id:string;symbol:string;metric:AlertMetric;threshold:number;enabled:boolean};
export type AlertObservation={symbol:string;price:number|null;changePercent:number|null;volatility20:number|null;volumeRatio:number|null;asOf:string|null};
export type AlertAssessment={ruleId:string;symbol:string;metric:AlertMetric;threshold:number;value:number|null;triggered:boolean;reason:string;asOf:string|null};
export function evaluateAlert(rule:AlertRule,observation:AlertObservation|null):AlertAssessment{
 const base={ruleId:rule.id,symbol:rule.symbol,metric:rule.metric,threshold:rule.threshold,asOf:observation?.asOf??null};
 if(!rule.enabled)return {...base,value:null,triggered:false,reason:'Rule disabled.'};
 if(!observation)return {...base,value:null,triggered:false,reason:'No observation available; rule not evaluated.'};
 const value=rule.metric==='price_above'||rule.metric==='price_below'?observation.price:
  rule.metric==='daily_change_abs'?observation.changePercent===null?null:Math.abs(observation.changePercent):
  rule.metric==='volatility_above'?observation.volatility20:observation.volumeRatio;
 if(value===null||!Number.isFinite(value))return {...base,value:null,triggered:false,reason:'Metric unavailable; no trigger inferred.'};
 const triggered=rule.metric==='price_below'?value<rule.threshold:value>rule.threshold;
 return {...base,value,triggered,reason:triggered?'Threshold exceeded in latest fetched observation.':'Threshold not exceeded in latest fetched observation.'};
}
